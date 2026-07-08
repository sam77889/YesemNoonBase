"""
NOON 类目级评论分析后台任务
按中文类目名聚合该品类下所有活跃商品的评论，持久化后供聚合分析接口查询。
"""
import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List

from sqlalchemy import select, or_, and_, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import async_session_maker
from app.models.product import TrackedProduct, ProductReview
from app.models.task import ScrapingTask
from app.services.fetcher_reviews import _fetch_raw_reviews
from app.services.category_mapping import denormalize_category

logger = logging.getLogger(__name__)


async def _find_category_skus(db: AsyncSession, category_label: str) -> List[str]:
    """根据中文类目名找出所有匹配 ACTIVE 商品的 SKU。"""
    mapping = denormalize_category(category_label)
    if not mapping:
        return []

    raw_cats = [c.lower() for c in mapping["raw"]]
    title_keywords = mapping.get("title_keywords", [])

    # category 精确匹配 raw 值
    conditions = [func.lower(TrackedProduct.category).in_(raw_cats)]

    # 当 category 为空 / home appliances 时，用 title 关键词兜底
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

    stmt = (
        select(TrackedProduct.sku)
        .where(TrackedProduct.status == "ACTIVE")
        .where(or_(*conditions))
        .distinct()
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.all()]


async def _persist_sku_reviews(db: AsyncSession, sku: str, reviews: List[Dict[str, Any]]) -> int:
    """删除旧评论并写入新评论，返回写入条数。"""
    await db.execute(delete(ProductReview).where(ProductReview.sku == sku))
    count = 0
    for r in reviews:
        created_at_ts = r.get("created_at")
        review_created_at = None
        if created_at_ts:
            try:
                review_created_at = datetime.utcfromtimestamp(int(created_at_ts))
            except Exception:
                pass

        pr = ProductReview(
            sku=sku,
            rating=r.get("rating", 0),
            title=r.get("title") or None,
            body=r.get("body") or None,
            author=r.get("author") or None,
            helpful_count=r.get("helpful_count", 0) or 0,
            verified=bool(r.get("verified")),
            review_created_at=review_created_at,
            fetched_at=datetime.utcnow(),
            raw_data=None,
        )
        db.add(pr)
        count += 1
    return count


async def run_category_review_analysis(job_id: str, category_label: str) -> None:
    """
    后台执行类目级评论抓取与分析。
    结果写入 product_reviews 表，任务状态写入 scraping_tasks。
    """
    logger.info(f"[CategoryReviews] 启动类目评论分析任务: {job_id}, 类目: {category_label}")

    async with async_session_maker() as db:
        result = await db.execute(select(ScrapingTask).where(ScrapingTask.job_id == job_id))
        task = result.scalar_one_or_none()
        if not task:
            logger.error(f"[CategoryReviews] 任务 {job_id} 不存在")
            return

        task.status = "PROCESSING"
        await db.commit()

        try:
            skus = await _find_category_skus(db, category_label)
            total = len(skus)
            logger.info(f"[CategoryReviews] 类目 {category_label} 匹配到 {total} 个活跃 SKU")

            if not skus:
                task.status = "FAILED"
                task.completed_at = datetime.utcnow()
                task.error_message = f"类目 {category_label} 下没有匹配到活跃商品"
                await db.commit()
                return

            sem = asyncio.Semaphore(2)

            async def _fetch_one(sku: str):
                async with sem:
                    result = await _fetch_raw_reviews(sku, limit=50)
                    await asyncio.sleep(0.5)
                    return sku, result

            tasks = [_fetch_one(sku) for sku in skus]
            results = await asyncio.gather(*tasks)

            saved_skus = 0
            saved_reviews = 0
            failed_skus = 0
            empty_skus = 0
            intercepted_skus = 0

            for sku, result in results:
                status = result.get("status")
                if status == "success":
                    reviews = result.get("reviews", [])
                    if reviews:
                        count = await _persist_sku_reviews(db, sku, reviews)
                        saved_reviews += count
                        saved_skus += 1
                    else:
                        empty_skus += 1
                elif status == "intercepted":
                    intercepted_skus += 1
                    failed_skus += 1
                elif status == "empty":
                    empty_skus += 1
                else:
                    failed_skus += 1

            await db.commit()

            if saved_skus == 0:
                task.status = "FAILED"
                task.error_message = (
                    f"类目 {category_label} 下 {total} 个 SKU 均未成功获取评论："
                    f"被拦截 {intercepted_skus} 个，无评论 {empty_skus} 个，失败 {failed_skus} 个。"
                )
            else:
                task.status = "SUCCESS"
                task.error_message = (
                    f"类目 {category_label} 分析完成："
                    f"共 {total} 个 SKU，成功保存 {saved_skus} 个 SKU 的 {saved_reviews} 条评论；"
                    f"被拦截 {intercepted_skus} 个，无评论 {empty_skus} 个，失败 {failed_skus} 个。"
                )
                task.result_count = saved_skus

            task.completed_at = datetime.utcnow()
            await db.commit()
            logger.info(f"[CategoryReviews] 任务 {job_id} 完成: {task.error_message}")

        except Exception as e:
            logger.exception(f"[CategoryReviews] 任务 {job_id} 异常: {e}")
            task.status = "FAILED"
            task.completed_at = datetime.utcnow()
            task.error_message = f"后台任务异常: {str(e)}"
            await db.commit()
