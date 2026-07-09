"""
NOON 数据分析系统 - 评论分析 API
提供单品评论抓取（保留在 products 路由）与类目级评论聚合分析。
"""
import logging
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.product import TrackedProduct, ProductReview
from app.models.task import ScrapingTask
from app.schemas.product import (
    CategoryAnalyzeRequest,
    CategoryAnalyzeResponse,
    CategoryAnalysisResponse,
)
from app.services.fetcher_reviews import analyze_reviews, _translate_reviews, _translate_analysis
from app.services.category_mapping import denormalize_category, list_supported_categories
from app.services.category_reviews import run_category_review_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reviews", tags=["评论分析"])


def _build_category_filter(category_label: str):
    """根据中文类目名构建 SQLAlchemy 过滤条件。"""
    mapping = denormalize_category(category_label)
    if not mapping:
        return None

    raw_cats = [c.lower() for c in mapping["raw"]]
    title_keywords = mapping.get("title_keywords", [])

    conditions = [func.lower(TrackedProduct.category).in_(raw_cats)]
    if title_keywords:
        title_conditions = [func.lower(TrackedProduct.title).contains(kw) for kw in title_keywords]
        conditions.append(
            and_(
                or_(
                    TrackedProduct.category.is_(None),
                    TrackedProduct.category == "",
                    func.lower(TrackedProduct.category) == "home appliances",
                ),
                or_(*title_conditions),
            )
        )
    return or_(*conditions)


async def _get_category_skus(
    db: AsyncSession, category_label: str
) -> tuple[List[str], int]:
    """返回匹配类目的 SKU 列表及总数。"""
    filter_expr = _build_category_filter(category_label)
    if filter_expr is None:
        return [], 0

    stmt = (
        select(TrackedProduct.sku)
        .where(TrackedProduct.status == "ACTIVE")
        .where(filter_expr)
        .distinct()
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [row[0] for row in rows], len(rows)


@router.post("/category/analyze", response_model=CategoryAnalyzeResponse)
async def start_category_analysis(
    request: CategoryAnalyzeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """启动类目级评论分析后台任务。"""
    category = request.category.strip()
    if category not in list_supported_categories():
        raise HTTPException(
            status_code=400,
            detail=f"不支持的类目: {category}。支持的类目: {', '.join(list_supported_categories())}",
        )

    skus, total = await _get_category_skus(db, category)
    if total == 0:
        raise HTTPException(
            status_code=404,
            detail=f"类目 {category} 下没有找到活跃商品",
        )

    job_id = f"catrev-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{category}"
    task = ScrapingTask(
        task_type="CATEGORY_REVIEWS",
        query=category,
        country="uae",
        language="en",
        status="PENDING",
        job_id=job_id,
        result_count=total,
    )
    db.add(task)
    await db.commit()

    background_tasks.add_task(run_category_review_analysis, job_id, category)
    logger.info(f"[Reviews API] 启动类目评论分析任务: {job_id}, 类目: {category}, SKU 数: {total}")

    return {
        "job_id": job_id,
        "message": f"已开始后台抓取类目 {category} 的评论，共 {total} 个商品",
        "total_products": total,
    }


@router.get("/category/analysis", response_model=CategoryAnalysisResponse)
async def get_category_analysis(
    category: str = Query(..., description="中文类目名"),
    review_limit: int = Query(50, ge=0, le=500, description="返回最近评论条数"),
    db: AsyncSession = Depends(get_db),
):
    """获取类目级评论聚合分析结果（基于已持久化的评论）。"""
    category = category.strip()
    if category not in list_supported_categories():
        raise HTTPException(
            status_code=400,
            detail=f"不支持的类目: {category}。支持的类目: {', '.join(list_supported_categories())}",
        )

    skus, product_count = await _get_category_skus(db, category)
    if product_count == 0:
        raise HTTPException(
            status_code=404,
            detail=f"类目 {category} 下没有找到活跃商品",
        )

    # 加载所有 persisted 评论（用于分析）
    stmt = (
        select(ProductReview)
        .where(ProductReview.sku.in_(skus))
        .order_by(ProductReview.review_created_at.desc())
    )
    result = await db.execute(stmt)
    review_rows = result.scalars().all()

    if not review_rows:
        return {
            "status": "empty",
            "message": f"类目 {category} 暂无已抓取的评论，请先调用 /category/analyze",
            "category": category,
            "product_count": product_count,
            "review_count": 0,
            "reviews": [],
            "analysis": analyze_reviews([]),
            "intercepted": False,
        }

    all_reviews = [
        {
            "rating": r.rating,
            "title": r.title or "",
            "body": r.body or "",
            "created_at": int(r.review_created_at.timestamp()) if r.review_created_at else None,
            "author": r.author or "",
            "helpful_count": r.helpful_count or 0,
            "verified": bool(r.verified),
        }
        for r in review_rows
    ]

    analysis = analyze_reviews(all_reviews)

    # 取最近 N 条用于展示并翻译
    display_reviews = all_reviews[:review_limit] if review_limit else []
    _translate_reviews(display_reviews)
    _translate_analysis(analysis)

    latest_fetched = max((r.fetched_at for r in review_rows if r.fetched_at), default=None)

    return {
        "status": "success",
        "message": f"类目 {category} 聚合分析完成，来自 {product_count} 个商品的 {len(all_reviews)} 条评论",
        "category": category,
        "product_count": product_count,
        "review_count": len(all_reviews),
        "reviews": display_reviews,
        "analysis": analysis,
        "intercepted": False,
        "from_cache": True,
        "cached_at": latest_fetched.isoformat() if latest_fetched else None,
    }
