"""
NOON 数据分析系统 - 价格监控与预警服务
当商品价格发生显著波动时，触发告警
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import PriceSnapshot

logger = logging.getLogger(__name__)


async def check_price_alerts(
    db: AsyncSession,
    sku: str,
    new_price: float,
) -> dict | None:
    """
    价格变动预警检查
    对比当前价格与最近一次快照的价格，超过阈值则触发告警
    
    :param db: 数据库会话
    :param sku: 商品 SKU
    :param new_price: 最新价格
    :return: 告警信息字典，无告警则返回 None
    """
    # 查询该 SKU 最近一条价格快照（不含本次刚写入的）
    stmt = (
        select(PriceSnapshot)
        .where(PriceSnapshot.sku == sku)
        .order_by(desc(PriceSnapshot.scraped_at))
        .offset(1)  # 跳过本次刚入库的记录
        .limit(1)
    )
    result = await db.execute(stmt)
    last_snapshot = result.scalar_one_or_none()

    if not last_snapshot or not last_snapshot.price:
        return None  # 首次记录，无需对比

    old_price = last_snapshot.price
    if old_price == 0:
        return None

    # 计算变动百分比
    change_percent = ((new_price - old_price) / old_price) * 100

    alert = None

    if abs(change_percent) > 20:
        # ── 严重告警：价格变动超过 20% ──
        level = "CRITICAL"
        direction = "暴跌" if change_percent < 0 else "暴涨"
        logger.critical(
            f"[价格预警] {level} | SKU={sku} | "
            f"{old_price} → {new_price} | {direction} {abs(change_percent):.1f}%"
        )
        alert = {
            "level": level,
            "sku": sku,
            "old_price": old_price,
            "new_price": new_price,
            "change_percent": round(change_percent, 1),
            "direction": direction,
            "detected_at": datetime.utcnow().isoformat(),
        }
    elif abs(change_percent) > 10:
        # ── 普通告警：价格变动超过 10% ──
        level = "WARNING"
        direction = "下降" if change_percent < 0 else "上涨"
        logger.warning(
            f"[价格预警] {level} | SKU={sku} | "
            f"{old_price} → {new_price} | {direction} {abs(change_percent):.1f}%"
        )
        alert = {
            "level": level,
            "sku": sku,
            "old_price": old_price,
            "new_price": new_price,
            "change_percent": round(change_percent, 1),
            "direction": direction,
            "detected_at": datetime.utcnow().isoformat(),
        }

    return alert


async def get_price_history(
    db: AsyncSession,
    sku: str,
    days: int = 30,
) -> list[PriceSnapshot]:
    """
    获取商品的价格历史记录
    
    :param db: 数据库会话
    :param sku: 商品 SKU
    :param days: 查询最近 N 天的数据
    :return: 按时间升序排列的价格快照列表
    """
    since = datetime.utcnow() - timedelta(days=days)

    stmt = (
        select(PriceSnapshot)
        .where(PriceSnapshot.sku == sku)
        .where(PriceSnapshot.scraped_at >= since)
        .order_by(PriceSnapshot.scraped_at.asc())
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()

    logger.info(f"[价格历史] SKU={sku} | 最近 {days} 天共 {len(snapshots)} 条记录")
    return list(snapshots)
