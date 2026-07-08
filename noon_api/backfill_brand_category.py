#!/usr/bin/env python3
"""
NOON 数据分析系统 - 历史数据回填脚本
从搜索结果中重新提取 brand / category / seller_name
补充到已有的 TrackedProduct 中。

使用方式:
  cd noon_api
  source venv/bin/activate
  python backfill_brand_category.py
"""
import asyncio
import logging
import sys
import os
import httpx
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import get_settings
from app.models.database import async_session_maker, init_db
from app.models.product import TrackedProduct, PriceSnapshot
from app.models.task import ScrapingTask
from app.services.scraperapi import parse_noon_search_html
from sqlalchemy import select, func

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)


def extract_brand_from_title(title: str) -> str:
    """从商品标题中启发式提取品牌"""
    if not title:
        return ""
    stop_words = {
        # ── 冠词/介词/连词 ──
        "the", "for", "with", "and", "or", "a", "an", "in", "on", "at",
        "to", "of", "by", "from", "is", "it", "no", "non", "new",
        # ── 功能/类型描述 ──
        "deep", "handheld", "muscle", "percussion", "heads", "head",
        "fascial", "fascia", "body", "massager", "massage", "gun",
        "device", "tool", "machine", "instrument", "apparatus",
        "equipment", "kit", "tissue", "tissues", "layer", "layers",
        "pain", "relaxation", "relief", "therapy", "therapeutic",
        "stimulator", "stimulation", "trigger", "point", "knot",
        "recovery", "rehabilitation", "physio", "therapy",
        # ── 材质/外观 ──
        "stainless", "steel", "plastic", "metal", "wooden", "silicone",
        "rubber", "aluminum", "aluminium", "chrome", "ceramic", "glass",
        "triangular", "double", "single", "triple", "quadruple",
        "round", "square", "flat", "curved", "wide", "narrow",
        "compact", "slim", "thin", "thick", "ergonomic",
        # ── 尺寸/容量 ──
        "large", "small", "mini", "long", "short", "big", "giant",
        "tiny", "micro", "macro", "xl", "xxl", "xs",
        "capacity", "volume", "size",
        # ── 动词/形容词 ──
        "portable", "rechargeable", "wireless", "cordless", "corded",
        "electric", "electronic", "digital", "smart", "intelligent",
        "auto", "automatic", "manual", "hand", "powered", "battery",
        "usb", "type", "fast", "quick", "rapid", "speed", "speeds",
        "turbo", "ultra", "super", "mega", "power", "powerful",
        "strong", "heavy", "duty", "professional", "industrial",
        "commercial", "medical", "home", "kitchen", "office",
        "outdoor", "indoor", "car", "travel", "personal", "family",
        "kids", "baby", "pet", "quiet", "silent", "noise",
        "high", "low", "medium", "full", "half", "level", "levels",
        "back", "neck", "shoulder", "leg", "arm", "foot", "head",
        "face", "eye", "ear", "tooth", "teeth", "skin", "hair",
        # ── 产品品类 ──
        "egg", "boiler", "cooker", "steamer", "mold", "ice", "maker",
        "beater", "mixer", "blender", "grinder", "chopper", "slicer",
        "dicer", "peeler", "opener", "cutter", "heater", "cooler",
        "fan", "humidifier", "purifier", "filter", "cleaner", "washer",
        "dryer", "iron", "vacuum", "light", "lamp", "bulb", "flash",
        "torch", "lantern", "charger", "cable", "adapter", "connector",
        "hub", "dock", "case", "cover", "protector", "guard", "stand",
        "holder", "mount", "bracket", "clip", "hook", "ring", "band",
        "strap", "pad", "mat", "cushion", "pillow", "blanket",
        # ── 技术规格 ──
        "lcd", "led", "hd", "wifi", "bluetooth", "bt", "nfc",
        "3d", "4k", "8k", "1080p", "720p", "fhd", "uhd", "hdr",
        "hz", "ghz", "mhz", "rpm", "watt", "volt", "amp", "mah",
        "gb", "tb", "mb", "kb", "db", "psi", "bar",
        # ── 颜色 ──
        "black", "white", "red", "blue", "green", "yellow", "orange",
        "purple", "pink", "brown", "grey", "gray", "silver", "gold",
        "rose", "navy", "beige", "cream", "teal", "cyan", "magenta",
        "color", "colour",
        # ── 数量/规格 ──
        "set", "pcs", "piece", "pack", "pair", "kit", "bundle",
        "combo", "lot", "suite", "in1", "in", "one",
        # ── 其他常见噪音词 ──
        "old", "original", "genuine", "authentic", "official",
        "classic", "vintage", "retro", "modern", "latest", "upgrade",
        "version", "edition", "pro", "plus", "lite", "basic", "standard",
        "premium", "deluxe", "ultimate", "advanced", "enhanced",
        "multi", "multipurpose", "multifunctional", "all",
        "function", "functions", "mode", "modes", "settings",
        "wtrtr", "youwe7", "kh", "1belle", "1bel",
        "2", "3", "4", "5", "6", "7", "8", "9", "10",
        "2in1", "3in1", "4in1", "5in1", "6in1",
        "ergonomic", "lightweight", "durable", "flexible",
        "adjustable", "foldable", "detachable", "removable",
        "washable", "reusable", "disposable", "waterproof",
        "non", "slip", "free", "safe", "certified",
        # ── 更多产品描述词 ──
        "fitness", "performance", "interchangeable", "intensity",
        "vibration", "relax", "athletes", "display", "charging",
        "dual", "three", "held", "multiple", "brushless", "attachments",
        "heat", "frequency", "therapeutic", "recovery", "rehabilitation",
        "cordless", "rechargeable", "lithium", "battery", "motor",
        "silent", "ultra", "quiet", "powerful", "high", "speed",
        "deep", "tissue", "trigger", "point", "knot", "pressure",
        "kneading", "rolling", "pulsing", "vibrating", "rotating",
        "oscillating", "percussive", "打击", "冲击", "振动",
        "electric", "electronic", "digital", "smart", "intelligent",
        "portable", "compact", "lightweight", "ergonomic", "durable",
        "flexible", "adjustable", "foldable", "detachable", "removable",
        "washable", "reusable", "disposable", "waterproof", "non",
        "slip", "free", "safe", "certified", "approved", "tested",
        "quality", "premium", "professional", "medical", "therapeutic",
        "clinical", "orthopedic", "anatomical", "physiological",
        "biomechanical", "neuromuscular", "myofascial", "fascial",
        "connective", "soft", "hard", "firm", "gentle", "smooth",
        "soft", "hard", "firm", "gentle", "smooth", "rough",
        "quiet", "silent", "noisy", "loud", "soft", "hard",
        "warm", "cool", "hot", "cold", "dry", "wet", "damp",
        "clean", "dirty", "fresh", "new", "used", "old", "worn",
        "broken", "damaged", "defective", "faulty", "working",
        "functional", "non-functional", "operational", "inoperable",
    }
    words = title.replace(",", " ").replace(":", " ").replace("-", " ").split()
    for word in words:
        clean = word.strip("()[]{}!?\"'.").lower()
        if len(clean) < 2 or clean in stop_words or clean.isdigit():
            continue
        # 跳过纯数字+字母混合（型号如 400W, 1080P, V2）
        if any(c.isdigit() for c in clean) and len(clean) <= 5:
            continue
        # 跳过看起来像型号的（含 + / . / _）
        if any(c in clean for c in "+._"):
            continue
        # 品牌通常是首字母大写或全大写，且不在 stop_words 中
        if word[0].isupper() or word.isupper():
            return word.strip("()[]{}!?\"'.")
    return ""


async def backfill():
    """主回填流程 - 使用单个 session"""
    await init_db()
    settings = get_settings()

    async with async_session_maker() as db:
        # 0. 清理噪音 brand（之前提取错误的）
        # 只清理那些在 stop_words 中的纯描述词品牌
        _stop = {
            "deep", "handheld", "muscle", "percussion", "heads", "head",
            "fascial", "fascia", "body", "massager", "massage", "gun",
            "device", "tool", "machine", "tissue", "tissues", "layer",
            "pain", "relaxation", "relief", "therapy", "stimulator",
            "fitness", "performance", "interchangeable", "intensity",
            "vibration", "relax", "athletes", "display", "charging",
            "dual", "three", "held", "multiple", "brushless", "attachments",
            "heat", "frequency", "quiet", "ultra", "powerful", "high",
            "speed", "speeds", "turbo", "mega", "super", "level", "levels",
            "back", "neck", "shoulder", "leg", "arm", "foot", "face",
            "rapid", "gear", "multi", "full", "double", "single",
            "automatic", "electronic", "digital", "advanced", "enhanced",
            "premium", "professional", "medical", "therapeutic",
            "portable", "rechargeable", "wireless", "cordless", "electric",
            "battery", "powered", "manual", "auto", "smart",
            "stainless", "steel", "plastic", "metal", "silicone",
            "triangular", "round", "square", "flat", "curved",
            "large", "small", "mini", "compact", "slim", "thin",
            "long", "short", "big", "giant", "tiny", "micro",
            "set", "pcs", "piece", "pack", "pair", "kit", "bundle",
            "new", "old", "original", "genuine", "authentic", "official",
            "classic", "vintage", "retro", "modern", "latest", "upgrade",
            "version", "edition", "pro", "plus", "lite", "basic",
            "ultimate", "deluxe", "standard", "function", "functions",
            "mode", "modes", "capacity", "adjustable", "foldable",
            "detachable", "removable", "washable", "reusable",
            "ergonomic", "lightweight", "durable", "flexible",
            "non", "slip", "free", "safe", "certified",
        }
        noise_brands = set()
        for product in (await db.execute(select(TrackedProduct).where(TrackedProduct.status == "ACTIVE"))).scalars().all():
            if product.brand and product.brand.lower() in _stop:
                noise_brands.add(product.brand)
                product.brand = ""
        if noise_brands:
            await db.commit()
            logger.info(f"清理了 {len(noise_brands)} 个噪音品牌: {sorted(noise_brands)[:20]}")

        # 1. 获取需要回填的商品
        # 条件：brand/category 缺失，或价格快照中 price == original_price（数据有问题）
        stmt = (
            select(TrackedProduct)
            .where(TrackedProduct.status == "ACTIVE")
            .where(
                (TrackedProduct.brand.is_(None))
                | (TrackedProduct.brand == "")
                | (TrackedProduct.category.is_(None))
                | (TrackedProduct.category == "")
            )
        )
        # 也获取价格有问题的商品（price == original_price 且 original_price 不为 None）
        price_bad_stmt = (
            select(TrackedProduct.sku)
            .join(PriceSnapshot, PriceSnapshot.sku == TrackedProduct.sku)
            .where(TrackedProduct.status == "ACTIVE")
            .where(PriceSnapshot.original_price.isnot(None))
            .where(PriceSnapshot.price == PriceSnapshot.original_price)
            .distinct()
        )
        price_bad_skus = set(row[0] for row in (await db.execute(price_bad_stmt)).all())
        result = await db.execute(stmt)
        products = result.scalars().all()

        if not products and not price_bad_skus:
            logger.info("所有商品已有 brand/category，无需回填")
            return

        # 也获取价格有问题但已有 brand/category 的商品
        if price_bad_skus:
            extra_stmt = select(TrackedProduct).where(TrackedProduct.sku.in_(price_bad_skus))
            extra_products = (await db.execute(extra_stmt)).scalars().all()
            products = list(products) + [p for p in extra_products if p.sku not in {pp.sku for pp in products}]

        logger.info(f"需要回填: {len(products)} 个商品")

        # 2. 获取搜索关键词
        q_stmt = (
            select(ScrapingTask.query)
            .where(ScrapingTask.status == "SUCCESS")
            .where(ScrapingTask.query.notlike("OFFER_%"))
            .distinct()
        )
        q_result = await db.execute(q_stmt)
        queries = [row[0] for row in q_result.all()]
        logger.info(f"搜索关键词: {queries}")

        # 3. 从搜索结果中提取 brand/category 映射
        sku_set = {p.sku for p in products} | price_bad_skus
        sku_data_map = {}

        for query in queries:
            logger.info(f"正在重新抓取: {query}")
            try:
                encoded_query = urllib.parse.quote(query)
                target_url = f"https://www.noon.com/uae-en/search/?q={encoded_query}&page=1"
                params = {
                    "api_key": settings.SCRAPERAPI_KEY,
                    "url": target_url,
                    "country_code": "ae",
                    "premium": "true",
                }
                async with httpx.AsyncClient(timeout=120) as http:
                    resp = await http.get(settings.SCRAPERAPI_URL, params=params)
                    resp.raise_for_status()
                    html = resp.text

                if html and len(html) > 1000:
                    page_products = parse_noon_search_html(html, query=query)
                    matched = 0
                    for p in page_products:
                        if p["sku"] in sku_set:
                            sku_data_map[p["sku"]] = {
                                "brand": p.get("brand", ""),
                                "category": p.get("category", ""),
                                "seller_name": p.get("seller_name", ""),
                                "price": p.get("price"),
                                "original_price": p.get("original_price"),
                                "discount_percent": p.get("discount_percent"),
                                "rating": p.get("rating"),
                                "review_count": p.get("review_count"),
                            }
                            matched += 1
                    logger.info(f"  匹配到 {matched} 个商品")
                else:
                    logger.warning(f"  抓取内容过短")
            except Exception as e:
                logger.error(f"  抓取异常: {e}")

        # 4. 更新数据库（同一个 session，同一个 ORM 对象）
        updated_products = 0
        updated_snapshots = 0
        for product in products:
            sku = product.sku
            new_data = sku_data_map.get(sku, {})
            changed = False

            # brand: 只用搜索结果中的真品牌，不用标题提取（噪音太大）
            new_brand = new_data.get("brand", "")
            if new_brand and (not product.brand or product.brand == ""):
                product.brand = new_brand
                changed = True

            # category: 优先用搜索结果
            new_category = new_data.get("category", "")
            if new_category and (not product.category or product.category == ""):
                product.category = new_category
                changed = True

            # seller_name
            new_seller = new_data.get("seller_name", "")
            if new_seller and (not product.seller_name or product.seller_name == ""):
                product.seller_name = new_seller
                changed = True

            if changed:
                updated_products += 1

            # 更新 PriceSnapshot（如果有新价格数据）
            new_price = new_data.get("price")  # sale_price
            new_original = new_data.get("original_price")  # 原价
            if new_price and product.price_snapshots:
                snapshot = product.price_snapshots[0]  # 最新快照
                # 如果当前 price 等于 original_price，说明旧数据把原价当售价了，需要修正
                if snapshot.original_price and snapshot.price == snapshot.original_price and new_original:
                    snapshot.price = new_price  # 修正为实际售价
                    snapshot.original_price = new_original
                    snapshot.discount_percent = new_data.get("discount_percent")
                    snapshot.rating = new_data.get("rating") or snapshot.rating
                    snapshot.review_count = new_data.get("review_count") or snapshot.review_count
                    updated_snapshots += 1

        await db.commit()
        logger.info(f"回填完成: 更新了 {updated_products} 个商品, {updated_snapshots} 个价格快照")

        # 5. 统计结果
        total = (await db.execute(select(func.count()).select_from(TrackedProduct).where(TrackedProduct.status == "ACTIVE"))).scalar() or 0
        with_brand = (await db.execute(select(func.count()).select_from(TrackedProduct).where(TrackedProduct.status == "ACTIVE").where(TrackedProduct.brand.isnot(None)).where(TrackedProduct.brand != ""))).scalar() or 0
        with_category = (await db.execute(select(func.count()).select_from(TrackedProduct).where(TrackedProduct.status == "ACTIVE").where(TrackedProduct.category.isnot(None)).where(TrackedProduct.category != ""))).scalar() or 0
        with_seller = (await db.execute(select(func.count()).select_from(TrackedProduct).where(TrackedProduct.status == "ACTIVE").where(TrackedProduct.seller_name.isnot(None)).where(TrackedProduct.seller_name != ""))).scalar() or 0

        logger.info(f"最终统计: {total} 个商品")
        logger.info(f"  有品牌: {with_brand} ({with_brand*100//total}%)")
        logger.info(f"  有分类: {with_category} ({with_category*100//total}%)")
        logger.info(f"  有卖家: {with_seller} ({with_seller*100//total}%)")


if __name__ == "__main__":
    asyncio.run(backfill())
