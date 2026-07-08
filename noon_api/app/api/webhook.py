"""
NOON 数据分析系统 - Webhook 接收端
接收 Oxylabs Web Scraper API 的异步回调数据
"""
import logging
from datetime import datetime
from fastapi import APIRouter, Header, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import get_db
from app.models.task import ScrapingTask
from app.schemas.task import OxylabsWebhookPayload
from app.services.etl import parse_search_results, parse_product_detail, save_products_to_db
from app.services.price_monitor import check_price_alerts

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/webhook", tags=["Webhook"])


@router.post("/oxylabs")
async def receive_oxylabs_webhook(
    payload: OxylabsWebhookPayload,
    x_webhook_secret: str = Header(default="", alias="X-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
):
    """
    Oxylabs 数据回调接口
    当 Oxylabs 完成抓取任务后，会向此端点 POST 结果数据

    安全性：通过 X-Webhook-Secret 请求头验证来源合法性
    """
    # ── 1. 验证 Webhook 密钥 ──
    if x_webhook_secret != settings.WEBHOOK_SECRET:
        logger.warning(f"[Webhook] 非法请求：密钥不匹配, job_id={payload.job_id}")
        raise HTTPException(status_code=403, detail="Webhook 密钥验证失败")

    logger.info(f"[Webhook] 收到回调: job_id={payload.job_id}, status={payload.status}")

    # ── 2. 更新对应的爬虫任务状态 ──
    stmt = select(ScrapingTask).where(ScrapingTask.job_id == payload.job_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if task:
        task.completed_at = datetime.utcnow()
        if payload.error:
            task.status = "FAILED"
            task.error_message = payload.error
            logger.error(f"[Webhook] 任务失败: job_id={payload.job_id}, error={payload.error}")
            return {"status": "received", "message": "任务失败已记录"}
        else:
            task.status = "SUCCESS"
    else:
        logger.warning(f"[Webhook] 未找到对应任务: job_id={payload.job_id}")

    # ── 3. ETL：解析并入库 ──
    if payload.results:
        # 根据任务类型选择不同的解析逻辑
        if task and task.task_type == "PRODUCT_DETAIL":
            product_data = parse_product_detail(payload.results)
            products = [product_data] if product_data else []
        else:
            products = parse_search_results(payload.results)

        if products:
            saved = await save_products_to_db(db, products)
            if task:
                task.result_count = saved

            # ── 4. 价格预警检查 ──
            alerts = []
            for p in products:
                if p.get("price") and p.get("sku"):
                    alert = await check_price_alerts(db, p["sku"], p["price"])
                    if alert:
                        alerts.append(alert)

            logger.info(f"[Webhook] 处理完成: 入库 {saved} 个商品, 触发 {len(alerts)} 个告警")
            return {
                "status": "received",
                "products_saved": saved,
                "alerts": alerts,
            }

    return {"status": "received", "products_saved": 0}
