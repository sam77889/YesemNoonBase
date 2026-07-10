"""
NOON 数据分析系统 - 本地直连爬虫适配层
将独立的 noon_scraper 模块（curl_cffi TLS 指纹模拟）适配为调度器可用的 provider。

无需付费 API，通过 impersonate="firefox" 绕过 Akamai Bot Manager。
"""
import sys
import asyncio
import logging
from pathlib import Path
from urllib.parse import quote

# 将仓库根目录加入 sys.path，使 noon_scraper 包可被 noon_api 导入
# __file__ = noon_api/app/services/fetcher_scraper.py
# parents[3] = noon_base（workspace 根，含 noon_scraper/ 包）
_WORKSPACE_ROOT = str(Path(__file__).resolve().parents[3])
if _WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, _WORKSPACE_ROOT)

from noon_scraper.fetcher import AsyncNoonScraper, extract_product_links  # noqa: E402

logger = logging.getLogger(__name__)


# ────────────────── 类型转换工具 ──────────────────

def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _to_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _adapt(raw: dict, query: str) -> dict:
    """将 noon_scraper 返回的商品字典映射为 ETL 入库格式。

    noon_scraper 字段: url, title, brand, price, currency, rating,
                      review_count, availability, seller, sku, image
    ETL 期望字段:      sku, title, price, original_price, brand, category,
                      image_url, product_url, rating, review_count,
                      seller_name, is_express, currency, discount_percent
    """
    price = _to_float(raw.get("price"))
    original_price = _to_float(raw.get("original_price"))
    discount_percent = None
    if original_price and price and original_price > price:
        discount_percent = round((1 - price / original_price) * 100, 1)

    return {
        "sku": raw.get("sku") or "",
        "title": raw.get("title") or "未知商品",
        "price": price,
        "original_price": original_price,
        "brand": raw.get("brand") or "",
        "category": query.strip() if not __import__("re").match(r"^[nN][a-zA-Z0-9]{6,20}$", query.strip()) else "",
        "image_url": raw.get("image") or "",
        "product_url": raw.get("url") or "",
        "rating": _to_float(raw.get("rating")),
        "review_count": _to_int(raw.get("review_count")),
        "sold_recently": _to_int(raw.get("sold_recently")),
        "seller_name": raw.get("seller") or "",
        "is_express": False,
        "currency": raw.get("currency") or "AED",
        "discount_percent": discount_percent,
    }


async def run_fetcher_scrape(
    query: str,
    country: str = "uae",
    language: str = "en",
    pages: int = 1,
    concurrency: int = 5,
    log_cb=None,
) -> list[dict]:
    """使用本地 curl_cffi 爬虫抓取搜索结果，返回适配 ETL 的商品列表。

    :param query: 搜索关键词（英文）
    :param country: 站点国家，如 uae
    :param language: 语言，如 en
    :param pages: 翻页数
    :param concurrency: 详情页并发数
    :param log_cb: 异步日志回调，签名 async (msg: str) -> None
    :return: 适配后的商品字典列表
    """
    base = f"https://www.noon.com/{country}-{language}"
    # noon 搜索默认 limit=50（SSR 只渲染 50 个）；实测 &limit=N 可提升单次返回量，上限 200。
    # 用 limit=200 使单次抓取量提升 4 倍，配合翻页 page=N 可继续累积。
    search_url = f"{base}/search?q={quote(query)}&limit=200"
    domain = "https://www.noon.com"

    async with AsyncNoonScraper(impersonate="firefox", concurrency=concurrency) as scraper:
        all_products: list[dict] = []
        seen_skus: set[str] = set()
        sem = asyncio.Semaphore(concurrency)

        # 复用 scraperapi 的 TSR 解析逻辑：noon 搜索页商品数据内联在 __TSR__ JS 对象中，
        # DOM <a> 链接仅含首屏少量商品（实测约 7 个），而 __TSR__ 含整页全部商品（约 50 个）。
        from app.services.scraperapi import parse_noon_search_html

        if log_cb:
            await log_cb(f"🦊 [Fetcher] 启动本地 curl_cffi 采集 (firefox 指纹)，目标: {search_url}")

        for page in range(1, pages + 1):
            url = f"{search_url}&page={page}" if page > 1 else search_url
            if log_cb:
                await log_cb(f"[P{page}] 🚀 抓取搜索页...")

            html = await scraper.fetch_page(url)
            if not html:
                if log_cb:
                    await log_cb(f"[P{page}] ❌ 搜索页抓取失败（被拦截或超时），跳过")
                continue

            # 优先：从 __TSR__ 内联数据提取（一页全部商品，含价格/评分，无需逐个抓详情页）
            tsr_products = parse_noon_search_html(html, query=query)

            if tsr_products:
                new_products = [p for p in tsr_products if p.get("sku") and p["sku"] not in seen_skus]
                if not new_products:
                    if log_cb:
                        await log_cb(f"[P{page}] 无新商品，停止翻页")
                    break
                seen_skus.update(p["sku"] for p in new_products)
                all_products.extend(new_products)
                if log_cb:
                    await log_cb(f"[P{page}] ✅ 从 __TSR__ 提取 {len(new_products)} 个商品（含价格/评分），累计 {len(all_products)}")
            else:
                # 回退：DOM 链接 + 逐个详情页抓取（JSON-LD 富数据）
                links = extract_product_links(html, domain)
                new_links = [l for l in links if l not in seen_skus]
                if not new_links:
                    if log_cb:
                        await log_cb(f"[P{page}] 无新商品，停止翻页")
                    break
                seen_skus.update(new_links)
                if log_cb:
                    await log_cb(f"[P{page}] TSR 无数据，回退详情页抓取，发现 {len(new_links)} 个链接（并发={concurrency}）...")

                async def worker(link: str) -> dict | None:
                    async with sem:
                        return await scraper.fetch_product(link)

                batch = await asyncio.gather(*(worker(l) for l in new_links))
                page_added = 0
                for raw in batch:
                    if raw and raw.get("sku"):
                        all_products.append(_adapt(raw, query))
                        page_added += 1
                if log_cb:
                    await log_cb(f"[P{page}] ✅ 详情页提取 {page_added} 个商品，累计 {len(all_products)}")

            if page < pages:
                await asyncio.sleep(1.0)

        if log_cb:
            await log_cb(f"🦊 [Fetcher] 全部抓取完成，共获取 {len(all_products)} 个商品")
        return all_products
