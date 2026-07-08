"""
NOON 数据分析系统 - 商品管理 API
提供商品追踪、查询、价格历史等接口
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.product import TrackedProduct, PriceSnapshot
from app.schemas.product import (
    ProductCreate, ProductResponse, ProductWithPrices, PriceSnapshotResponse
)
from app.services.price_monitor import get_price_history

logger = logging.getLogger(__name__)

from app.services.fetcher_reviews import fetch_product_reviews

router = APIRouter(prefix="/api/v1/products", tags=["商品管理"])


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=50000, description="每页数量"),
    status: str = Query("ACTIVE", description="商品状态筛选"),
    db: AsyncSession = Depends(get_db),
):
    """获取所有追踪中的商品列表（分页）"""
    stmt = (
        select(TrackedProduct)
        .where(TrackedProduct.status == status)
        .options(selectinload(TrackedProduct.price_snapshots))
        .offset(skip)
        .limit(limit)
        .order_by(TrackedProduct.updated_at.desc())
    )
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    res = []
    for p in products:
        d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        if p.price_snapshots:
            latest = max(p.price_snapshots, key=lambda s: s.scraped_at)
            d['price'] = latest.price
            d['original_price'] = latest.original_price
            d['discount_percent'] = latest.discount_percent
            d['rating'] = latest.rating
            d['review_count'] = latest.review_count
        res.append(d)
        
    return res


@router.get("/{sku}/reviews")
async def get_product_reviews(sku: str, limit: int = 50):
    """
    抓取商品的具体评论并返回轻量分析结果。

    返回结构：
    {
        "status": "success" | "intercepted" | "empty" | "error",
        "message": "...",
        "reviews": [...],
        "analysis": {...},
        "count": int,
        "intercepted": bool,
    }
    """
    result = await fetch_product_reviews(sku, limit=limit)
    return result


@router.get("/stats")
async def get_product_stats(db: AsyncSession = Depends(get_db)):
    """获取商品统计概览"""
    # 总追踪商品数
    total_stmt = select(func.count()).select_from(TrackedProduct).where(TrackedProduct.status == "ACTIVE")
    total = (await db.execute(total_stmt)).scalar() or 0

    # 活跃商品数
    active_stmt = (
        select(func.count())
        .select_from(TrackedProduct)
        .where(TrackedProduct.status == "ACTIVE")
    )
    active = (await db.execute(active_stmt)).scalar() or 0

    # 价格快照总数
    snapshot_stmt = select(func.count()).select_from(PriceSnapshot)
    snapshots = (await db.execute(snapshot_stmt)).scalar() or 0

    return {
        "total_products": total,
        "active_products": active,
        "total_snapshots": snapshots,
    }


@router.get("/{sku}", response_model=ProductWithPrices)
async def get_product_detail(
    sku: str,
    db: AsyncSession = Depends(get_db),
):
    """获取单个商品详情（含最近价格快照）"""
    stmt = (
        select(TrackedProduct)
        .where(TrackedProduct.sku == sku)
        .options(selectinload(TrackedProduct.price_snapshots))
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail=f"商品 {sku} 未找到")

    # 从最新快照复制价格数据
    d = {c.name: getattr(product, c.name) for c in product.__table__.columns}
    if product.price_snapshots:
        latest = max(product.price_snapshots, key=lambda s: s.scraped_at)
        d['price'] = latest.price
        d['original_price'] = latest.original_price
        d['discount_percent'] = latest.discount_percent
        d['rating'] = latest.rating
        d['review_count'] = latest.review_count
    d['price_snapshots'] = product.price_snapshots
    return d


@router.post("/track", response_model=ProductResponse)
async def track_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    """添加商品到追踪列表"""
    # 检查是否已存在
    stmt = select(TrackedProduct).where(TrackedProduct.sku == product_data.sku)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        if existing.status == "INACTIVE":
            existing.status = "ACTIVE"
            logger.info(f"[商品管理] 重新激活追踪: SKU={product_data.sku}")
            return existing
        raise HTTPException(status_code=409, detail=f"商品 {product_data.sku} 已在追踪列表中")

    new_product = TrackedProduct(**product_data.model_dump())
    db.add(new_product)
    await db.flush()
    logger.info(f"[商品管理] 新增追踪: SKU={product_data.sku}, title={product_data.title}")
    return new_product


@router.delete("/{sku}")
async def stop_tracking(
    sku: str,
    db: AsyncSession = Depends(get_db),
):
    """停止追踪某个商品（软删除，状态改为 INACTIVE）"""
    stmt = select(TrackedProduct).where(TrackedProduct.sku == sku)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail=f"商品 {sku} 未找到")

    product.status = "INACTIVE"
    logger.info(f"[商品管理] 停止追踪: SKU={sku}")
    return {"message": f"已停止追踪商品 {sku}"}


@router.get("/{sku}/prices", response_model=list[PriceSnapshotResponse])
async def get_product_prices(
    sku: str,
    days: int = Query(30, ge=1, le=365, description="查询最近 N 天"),
    db: AsyncSession = Depends(get_db),
):
    """获取商品的价格历史记录"""
    # 先验证商品存在
    stmt = select(TrackedProduct).where(TrackedProduct.sku == sku)
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"商品 {sku} 未找到")

    snapshots = await get_price_history(db, sku, days)
    return snapshots
