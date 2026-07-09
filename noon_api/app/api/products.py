"""
NOON 数据分析系统 - 商品管理 API
提供商品追踪、查询、价格历史等接口
"""
import logging
import math
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete, or_, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.product import TrackedProduct, PriceSnapshot, ProductReview
from app.schemas.product import (
    ProductCreate, ProductResponse, ProductWithPrices, PriceSnapshotResponse,
    ProductListResponse, CategoryCount, OverviewAggregation,
    OverviewSummary, PriceBucket, PriceSalesScatterPoint, BrandRankItem,
)
from app.services.price_monitor import get_price_history

logger = logging.getLogger(__name__)

from app.services.fetcher_reviews import fetch_product_reviews, analyze_reviews, _translate_reviews, _translate_analysis
from app.services.category_reviews import _persist_sku_reviews
from app.services.category_mapping import get_chinese_label

# 类目过滤哨兵值（前后端必须一致）
UNCATEGORIZED_PARAM = '__UNCATEGORIZED__'

router = APIRouter(prefix="/api/v1/products", tags=["商品管理"])


# 排序白名单：仅允许这些列参与 ORDER BY，杜绝列名拼接注入
_COLUMN_SORTS = {
    'updated_at': TrackedProduct.updated_at,
    'created_at': TrackedProduct.created_at,
    'title': TrackedProduct.title,
    'brand': TrackedProduct.brand,
    'sku': TrackedProduct.sku,
}
# 价格 / 评分 / 评论数来自「最新快照」，数据库无对应列，需取全量后在内存排序
_SNAPSHOT_SORTS = {'price', 'rating', 'review_count'}

# 类目过滤哨兵值（前后端必须一致）
UNCATEGORIZED_PARAM = '__UNCATEGORIZED__'


def _to_item(p: TrackedProduct) -> dict:
    """将 ORM 对象 + 最新快照映射为前端所需的 dict（与改造前 list_products 行为一致）。"""
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    if p.price_snapshots:
        latest = max(p.price_snapshots, key=lambda s: s.scraped_at)
        d['price'] = latest.price
        d['original_price'] = latest.original_price
        d['discount_percent'] = latest.discount_percent
        d['rating'] = latest.rating
        d['review_count'] = latest.review_count
    return d


def _build_where(status: str, category: str | None, q: str | None):
    """构造过滤条件（status 必选；category/q 可选）。"""
    conditions = [TrackedProduct.status == status]
    if category:
        if category == UNCATEGORIZED_PARAM:
            conditions.append(
                or_(TrackedProduct.category.is_(None), TrackedProduct.category == '')
            )
        else:
            values = [v.strip() for v in category.split(',') if v.strip()]
            if values:
                conditions.append(TrackedProduct.category.in_(values))
    if q:
        like = f"%{q}%"
        # SQLite 下 ilike 由 SQLAlchemy 编译为 LOWER(col) LIKE LOWER(:param)
        conditions.append(
            or_(
                TrackedProduct.title.ilike(like),
                TrackedProduct.brand.ilike(like),
                TrackedProduct.category.ilike(like),
            )
        )
    return conditions


@router.get("/", response_model=ProductListResponse)
async def list_products(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(20, ge=1, le=50000, description="每页数量"),
    status: str = Query("ACTIVE", description="商品状态筛选"),
    category: str | None = Query(None, description="逗号分隔原始英文类目；__UNCATEGORIZED__ 表示空类目"),
    q: str | None = Query(None, description="title/brand/category 模糊搜索"),
    sort: str = Query("updated_at", description="排序字段（白名单）"),
    order: str = Query("desc", description="asc / desc"),
    db: AsyncSession = Depends(get_db),
):
    """获取所有追踪中的商品列表（服务端分页 / 过滤 / 排序）"""
    conditions = _build_where(status, category, q)
    total = (
        await db.execute(
            select(func.count()).select_from(TrackedProduct).where(*conditions)
        )
    ).scalar() or 0

    order_col = _COLUMN_SORTS.get(sort, TrackedProduct.updated_at)
    direction = desc if order == 'desc' else asc

    if sort in _SNAPSHOT_SORTS:
        # 快照派生字段无法走 DB order_by，取全量后在内存排序再切片
        stmt = (
            select(TrackedProduct)
            .where(*conditions)
            .options(selectinload(TrackedProduct.price_snapshots))
        )
        products = (await db.execute(stmt)).scalars().all()
        items = [_to_item(p) for p in products]
        key = sort

        def _sort_key(d: dict):
            v = d.get(key)
            return v if v is not None else (float('-inf') if order == 'desc' else float('inf'))

        items.sort(key=_sort_key, reverse=(order == 'desc'))
        items = items[skip: skip + limit]
    else:
        stmt = (
            select(TrackedProduct)
            .where(*conditions)
            .options(selectinload(TrackedProduct.price_snapshots))
            .order_by(direction(order_col).nulls_last())
            .offset(skip)
            .limit(limit)
        )
        products = (await db.execute(stmt)).scalars().all()
        items = [_to_item(p) for p in products]

    return {"items": items, "total": total}


@router.get("/{sku}/reviews")
async def get_product_reviews(
    sku: str,
    limit: int = 50,
    refresh: bool = Query(False, description="强制重新抓取，忽略本地缓存"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取商品的评论深度分析结果。

    策略（本地优先）：
    - refresh=false（默认）：优先从 product_reviews 表读取已持久化评论，重新计算分析后返回。
      若本地无数据，则实时抓取并持久化。
    - refresh=true：强制实时抓取，成功后覆盖持久化数据。

    返回结构：
    {
        "status": "success" | "intercepted" | "empty" | "error",
        "message": "...",
        "reviews": [...],
        "analysis": {...},
        "count": int,
        "intercepted": bool,
        "from_cache": bool,
        "cached_at": "ISO" | null,
    }
    """
    # 1. 非 refresh 模式：先查本地
    if not refresh:
        stmt = (
            select(ProductReview)
            .where(ProductReview.sku == sku)
            .order_by(ProductReview.review_created_at.desc())
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        if rows:
            cached_reviews = [
                {
                    "rating": r.rating,
                    "title": r.title or "",
                    "body": r.body or "",
                    "created_at": int(r.review_created_at.timestamp()) if r.review_created_at else None,
                    "author": r.author or "",
                    "helpful_count": r.helpful_count or 0,
                    "verified": bool(r.verified),
                }
                for r in rows
            ]
            if limit and limit > 0:
                cached_reviews = cached_reviews[:limit]

            analysis = analyze_reviews(cached_reviews)
            try:
                _translate_reviews(cached_reviews)
                _translate_analysis(analysis)
            except Exception as e:
                logger.error(f"[Reviews] Translation failed for cached: {e}")

            latest_fetched = max((r.fetched_at for r in rows if r.fetched_at), default=None)

            return {
                "status": "success",
                "message": f"已加载本地缓存 {len(cached_reviews)} 条评论（抓取于 {latest_fetched.strftime('%Y-%m-%d %H:%M') if latest_fetched else '未知'}，点击「重新抓取」获取最新数据）。",
                "reviews": cached_reviews,
                "analysis": analysis,
                "count": len(cached_reviews),
                "intercepted": False,
                "from_cache": True,
                "cached_at": latest_fetched.isoformat() if latest_fetched else None,
            }
        # 本地无数据，落回实时抓取

    # 2. 实时抓取
    result = await fetch_product_reviews(sku, limit=limit)
    result["from_cache"] = False
    result["cached_at"] = None

    # 3. 抓取成功则持久化（覆盖旧数据）
    if result.get("status") == "success" and result.get("reviews"):
        try:
            saved = await _persist_sku_reviews(db, sku, result["reviews"])
            await db.commit()
            logger.info(f"[Reviews] SKU {sku} 持久化 {saved} 条评论")
            result["message"] = f"成功抓取并保存 {len(result['reviews'])} 条评论。"
            result["cached_at"] = datetime.utcnow().isoformat()
        except Exception as e:
            logger.error(f"[Reviews] 持久化失败 SKU {sku}: {e}")
            await db.rollback()

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


@router.get("/stats/categories", response_model=list[CategoryCount])
async def get_category_counts(db: AsyncSession = Depends(get_db)):
    """按原始英文类目（含空类目）分组计数，供前端反查中文标签 tab。"""
    stmt = (
        select(TrackedProduct.category, func.count())
        .where(TrackedProduct.status == "ACTIVE")
        .group_by(TrackedProduct.category)
    )
    rows = (await db.execute(stmt)).all()
    label_counts = {}
    label_values = {}
    uncategorized_count = 0

    valid_cats = []
    cat_to_count = {}
    for cat_val, count in rows:
        if not cat_val:
            uncategorized_count += count
            continue
        valid_cats.append(cat_val)
        cat_to_count[cat_val] = count
        
    for cat_val in valid_cats:
        zh_label = await get_chinese_label(cat_val, db)
        count = cat_to_count[cat_val]
        
        if zh_label not in label_counts:
            label_counts[zh_label] = 0
            label_values[zh_label] = []
        
        label_counts[zh_label] += count
        label_values[zh_label].append(cat_val.strip())

    result = []
    for label, count in label_counts.items():
        val_str = ",".join(label_values[label])
        result.append(CategoryCount(label=label, value=val_str, count=count))

    if uncategorized_count > 0:
        result.append(CategoryCount(label="未分类", value=UNCATEGORIZED_PARAM, count=uncategorized_count))

    result.sort(key=lambda x: x.count, reverse=True)
    
    try:
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to commit category translation cache: {e}")
        await db.rollback()
        
    return result


def _estimate_sales(d: dict) -> int:
    """复刻前端 utils.estimateSales 经验公式。"""
    return math.floor(
        (d.get('review_count') or 0) * 38
        + 1500 / max(d.get('price') or 1, 10)
        + (d.get('rating') or 3.5) * 20
    )


def _compute_overview(items: list[dict]) -> dict:
    """复刻前端 OverviewPage 的 4 段聚合算法（IQR+20 桶 / 品牌 TOP10 / 散点 TOP500）。"""
    # 1) 价格段分布
    prices = sorted(
        p['price'] for p in items
        if p.get('price') is not None and p['price'] > 0
    )
    price_distribution: list[dict] = []
    if prices:
        min_price = prices[0]
        max_price = prices[-1]
        if len(prices) > 4:
            q1 = prices[math.floor(len(prices) * 0.25)]
            q3 = prices[math.floor(len(prices) * 0.75)]
            iqr = q3 - q1
            lower_bound = max(0, q1 - 1.5 * iqr)
            upper_bound = q3 + 1.5 * iqr
            valid = [p for p in prices if lower_bound <= p <= upper_bound]
            if valid:
                min_price = valid[0]
                max_price = valid[-1]
        if min_price == float('inf') or min_price == max_price:
            price_distribution = [{
                "name": f"{min_price or 0}",
                "productCount": len(items),
                "totalReviews": 0,
            }]
        else:
            bucket_count = 20
            interval = (max_price - min_price + 0.01) / bucket_count
            bucket_product = [0] * bucket_count
            bucket_review = [0] * bucket_count
            bucket_labels = [''] * bucket_count
            for i in range(bucket_count):
                start = math.floor(min_price + i * interval)
                end = (math.ceil(max_price) if i == bucket_count - 1
                       else math.floor(min_price + (i + 1) * interval - 1))
                bucket_labels[i] = f"{start}-{end}"
            for p in items:
                price = p.get('price')
                reviews = p.get('review_count') or 0
                if price is not None and min_price <= price <= max_price:
                    idx = min(max(math.floor((price - min_price) / interval), 0), bucket_count - 1)
                    bucket_product[idx] += 1
                    bucket_review[idx] += reviews
            price_distribution = [
                {"name": bucket_labels[i], "productCount": bucket_product[i], "totalReviews": bucket_review[i]}
                for i in range(bucket_count) if bucket_product[i] > 0
            ]

    # 2) 价格-销量散点（按预估销量截断 TOP500）
    scatter = []
    for p in items:
        price = p.get('price')
        if price is None or price <= 0:
            continue
        scatter.append({
            "name": (p.get('title') or '')[:20],
            "price": price,
            "sales": _estimate_sales(p),
            "reviews": p.get('review_count') or 0,
            "rating": p.get('rating') or 0,
        })
    scatter.sort(key=lambda x: x['sales'], reverse=True)
    scatter = scatter[:500]

    # 3) 品牌竞争力 TOP10
    brand_map: dict[str, dict] = {}
    for p in items:
        brand = (p.get('brand') or '').upper().strip() or '白牌'
        d = brand_map.setdefault(brand, {"count": 0, "reviews": 0, "rating": 0.0, "rated": 0})
        d['count'] += 1
        d['reviews'] += (p.get('review_count') or 0)
        if p.get('rating'):
            d['rating'] += p['rating']
            d['rated'] += 1
    brand_ranking = []
    for name, d in brand_map.items():
        nm = name[:12] + '…' if len(name) > 12 else name
        avg = (math.floor(d['rating'] / d['rated'] * 10 + 0.5) / 10) if d['rated'] > 0 else 0
        brand_ranking.append({"name": nm, "商品数": d['count'], "总评论": d['reviews'], "均分": avg})
    brand_ranking.sort(key=lambda x: x['总评论'], reverse=True)
    brand_ranking = brand_ranking[:10]

    return {
        "price_distribution": price_distribution,
        "price_sales_scatter": scatter,
        "brand_ranking": brand_ranking,
    }


@router.get("/stats/overview", response_model=OverviewAggregation)
async def get_overview_stats(
    category: str | None = Query(None, description="逗号分隔原始英文类目；__UNCATEGORIZED__ 表示空类目"),
    q: str | None = Query(None, description="title/brand/category 模糊搜索"),
    db: AsyncSession = Depends(get_db),
):
    """大盘总览聚合：服务端复刻前端算法，避免首屏拉取全量数据。"""
    conditions = _build_where("ACTIVE", category, q)
    stmt = (
        select(TrackedProduct)
        .where(*conditions)
        .options(selectinload(TrackedProduct.price_snapshots))
    )
    products = (await db.execute(stmt)).scalars().all()
    items = [_to_item(p) for p in products]

    # summary 与改造前 dynamicStats 语义对齐：
    # - All（无 category）：total_products/active_products 取 ACTIVE 总数，total_reviews 取快照总数
    # - 选类目：total_products=命中数，active_products=有价商品数，total_reviews=评论数求和
    if not category:
        total_reviews = (
            await db.execute(select(func.count()).select_from(PriceSnapshot))
        ).scalar() or 0
        summary = OverviewSummary(
            total_products=len(items),
            active_products=len(items),
            total_reviews=total_reviews,
        )
    else:
        summary = OverviewSummary(
            total_products=len(items),
            active_products=sum(1 for d in items if d.get('price') is not None),
            total_reviews=sum(d.get('review_count') or 0 for d in items),
        )

    agg = _compute_overview(items)
    return OverviewAggregation(
        summary=summary,
        price_distribution=[PriceBucket(**b) for b in agg['price_distribution']],
        price_sales_scatter=[PriceSalesScatterPoint(**s) for s in agg['price_sales_scatter']],
        brand_ranking=[BrandRankItem(**b) for b in agg['brand_ranking']],
    )


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
