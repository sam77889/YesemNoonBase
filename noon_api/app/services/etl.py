"""
NOON 数据分析系统 - ETL 数据清洗管道
将 Oxylabs Webhook 回调的原始 JSON 数据清洗、打平，存入数据库
"""
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.product import TrackedProduct, PriceSnapshot

logger = logging.getLogger(__name__)


def parse_search_results(raw_results: list[dict]) -> list[dict]:
    """
    解析 Oxylabs 搜索结果页的原始数据
    将嵌套的 JSON 结构提取为扁平化的商品字典列表
    
    :param raw_results: Oxylabs 返回的 results 列表
    :return: 清洗后的商品数据列表
    """
    products = []

    for result in raw_results:
        # Oxylabs 返回的内容通常在 result['content'] 中
        content = result.get("content", {})

        # 如果 content 是字符串（HTML），则跳过，我们只处理结构化数据
        if isinstance(content, str):
            logger.warning("[ETL] 收到 HTML 原始内容，跳过（需开启 parse=True）")
            continue

        # 尝试从不同的数据路径提取商品列表
        items = (
            content.get("results", [])
            or content.get("products", [])
            or content.get("organic", [])
            or []
        )

        for item in items:
            try:
                product = {
                    "sku": str(item.get("sku", item.get("id", item.get("asin", "")))),
                    "title": item.get("title", item.get("name", "未知商品")),
                    "price": _safe_float(item.get("price", item.get("price_current"))),
                    "original_price": _safe_float(item.get("original_price", item.get("price_original"))),
                    "brand": item.get("brand", ""),
                    "category": item.get("category", ""),
                    "image_url": item.get("image", item.get("thumbnail", "")),
                    "product_url": item.get("url", item.get("link", "")),
                    "rating": _safe_float(item.get("rating")),
                    "review_count": _safe_int(item.get("review_count", item.get("reviews_count"))),
                    "seller_name": item.get("seller", item.get("merchant", "")),
                    "is_express": _check_express(item),
                    "currency": item.get("currency", "AED"),
                }

                # 计算折扣百分比
                if product["price"] and product["original_price"] and product["original_price"] > 0:
                    product["discount_percent"] = round(
                        (1 - product["price"] / product["original_price"]) * 100, 1
                    )
                else:
                    product["discount_percent"] = None

                # 只保留有效 SKU 的商品
                if product["sku"]:
                    products.append(product)
            except Exception as e:
                logger.warning(f"[ETL] 解析单个商品失败: {e}")
                continue

    logger.info(f"[ETL] 搜索结果解析完成，共提取 {len(products)} 个商品")
    return products


def parse_product_detail(raw_results: list[dict]) -> dict | None:
    """
    解析 Oxylabs 商品详情页的原始数据
    
    :param raw_results: Oxylabs 返回的 results 列表
    :return: 清洗后的单个商品字典，或 None
    """
    if not raw_results:
        return None

    result = raw_results[0]
    content = result.get("content", {})
    if isinstance(content, str):
        return None

    try:
        return {
            "sku": str(content.get("sku", content.get("id", ""))),
            "title": content.get("title", content.get("name", "")),
            "price": _safe_float(content.get("price")),
            "original_price": _safe_float(content.get("original_price")),
            "brand": content.get("brand", ""),
            "category": content.get("category", ""),
            "image_url": content.get("image", ""),
            "product_url": content.get("url", ""),
            "rating": _safe_float(content.get("rating")),
            "review_count": _safe_int(content.get("review_count")),
            "seller_name": content.get("seller", ""),
            "is_express": _check_express(content),
            "currency": content.get("currency", "AED"),
        }
    except Exception as e:
        logger.error(f"[ETL] 商品详情解析失败: {e}")
        return None


async def save_products_to_db(db: AsyncSession, products: list[dict]) -> int:
    """
    将清洗后的商品数据写入数据库（Upsert 逻辑）
    - TrackedProduct: 不存在则插入，存在则更新基础信息
    - PriceSnapshot: 始终插入一条新的价格快照
    
    :param db: 异步数据库会话
    :param products: 清洗后的商品列表
    :return: 成功入库的商品数量
    """
    saved_count = 0

    for product_data in products:
        try:
            sku = product_data["sku"]

            # ── 1. Upsert TrackedProduct ──
            stmt = select(TrackedProduct).where(TrackedProduct.sku == sku)
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                # 更新已存在的商品信息
                existing.title = product_data.get("title") or existing.title
                existing.brand = product_data.get("brand") or existing.brand
                existing.category = product_data.get("category") or existing.category
                existing.image_url = product_data.get("image_url") or existing.image_url
                existing.product_url = product_data.get("product_url") or existing.product_url
                existing.is_express = product_data.get("is_express", existing.is_express)
                existing.seller_name = product_data.get("seller_name") or existing.seller_name
                existing.price = product_data.get("price") or existing.price
                existing.original_price = product_data.get("original_price") or existing.original_price
                existing.discount_percent = product_data.get("discount_percent") or existing.discount_percent
                existing.rating = product_data.get("rating") or existing.rating
                existing.review_count = product_data.get("review_count") or existing.review_count
                existing.sold_recently = product_data.get("sold_recently") or existing.sold_recently
                existing.updated_at = datetime.utcnow()
            else:
                # 插入新商品
                new_product = TrackedProduct(
                    sku=sku,
                    title=product_data.get("title", ""),
                    brand=product_data.get("brand"),
                    category=product_data.get("category"),
                    image_url=product_data.get("image_url"),
                    product_url=product_data.get("product_url"),
                    is_express=product_data.get("is_express", False),
                    seller_name=product_data.get("seller_name"),
                    price=product_data.get("price"),
                    original_price=product_data.get("original_price"),
                    discount_percent=product_data.get("discount_percent"),
                    rating=product_data.get("rating"),
                    review_count=product_data.get("review_count"),
                    sold_recently=product_data.get("sold_recently"),
                )
                db.add(new_product)

            # ── 2. 插入价格快照 ──
            if product_data.get("price"):
                snapshot = PriceSnapshot(
                    sku=sku,
                    price=product_data["price"],
                    original_price=product_data.get("original_price"),
                    currency=product_data.get("currency", "AED"),
                    discount_percent=product_data.get("discount_percent"),
                    rating=product_data.get("rating"),
                    review_count=product_data.get("review_count"),
                    sold_recently=product_data.get("sold_recently"),
                    seller_name=product_data.get("seller_name"),
                    raw_data=product_data,
                )
                db.add(snapshot)

            saved_count += 1

        except Exception as e:
            logger.error(f"[ETL] 保存商品 {product_data.get('sku')} 失败: {e}")
            continue

    await db.flush()
    logger.info(f"[ETL] 成功入库 {saved_count}/{len(products)} 个商品")
    return saved_count


# ────────────────── 工具函数 ──────────────────

def _safe_float(value) -> float | None:
    """安全转换为浮点数"""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _safe_int(value) -> int | None:
    """安全转换为整数"""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _check_express(item: dict) -> bool:
    """检查商品是否为 NOON Express（平台履约）"""
    fulfilment = str(item.get("fulfilment", item.get("fulfillment", ""))).lower()
    return "express" in fulfilment or "noon" in fulfilment
