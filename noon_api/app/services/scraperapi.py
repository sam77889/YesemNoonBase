"""
NOON 数据分析系统 - ScraperAPI 客户端
使用 ScraperAPI 代理服务抓取 NOON 商品数据
特点: 免费试用(7天5000次)、自动IP轮换、自动JS渲染、自动绕过反爬

调用方式（同步模式）:
  GET https://api.scraperapi.com?api_key=xxx&url=目标URL&render=true
  返回: 渲染后的完整 HTML
"""
import logging
import httpx
import asyncio
from bs4 import BeautifulSoup
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ScraperAPIClient:
    """ScraperAPI 代理抓取客户端"""

    def __init__(self):
        self.api_key = settings.SCRAPERAPI_KEY
        self.api_url = settings.SCRAPERAPI_URL

    async def scrape_search_page(
        self,
        query: str,
        country: str = "uae",
        language: str = "en",
        log_cb = None,
        page: int | None = None,
    ) -> dict:
        """
        抓取 NOON 搜索结果页 (单线串行 + 随机/精确翻页)
        """
        import random
        import urllib.parse
        
        target_page = page if page is not None else random.randint(1, 10)
        encoded_query = urllib.parse.quote(query)
        target_url = f"https://www.noon.com/{country}-{language}/search/?q={encoded_query}&page={target_page}&limit=200"

        params = {
            "api_key": self.api_key,
            "url": target_url,
            "country_code": "ae",
            "premium": "true",
        }

        prefix = f"[P{target_page}]"
        
        if log_cb:
            await log_cb(f"{prefix} 🚀 目标 URL: {target_url}")

        max_retries = 3
        async with httpx.AsyncClient(timeout=120) as client:
            for attempt in range(1, max_retries + 1):
                if log_cb:
                    await log_cb(f"{prefix} 发起请求 (Attempt {attempt}/{max_retries})...")
                try:
                    resp = await client.get(self.api_url, params=params)
                    resp.raise_for_status()
                    
                    if "Just a moment" in resp.text or "Cloudflare" in resp.text:
                        if log_cb:
                            await log_cb(f"{prefix} ❌ 被反爬拦截 (Cloudflare/Captcha)")
                    else:
                        if log_cb:
                            await log_cb(f"{prefix} ✅ 请求成功! 返回 {len(resp.text)} 字节")
                        return {"html": resp.text, "url": target_url, "status": "success"}
                except httpx.HTTPStatusError as e:
                    if log_cb:
                        await log_cb(f"{prefix} ⚠️ HTTP 错误: {e.response.status_code}")
                except Exception as e:
                    if log_cb:
                        await log_cb(f"{prefix} ❌ 异常: {e}")

                if attempt < max_retries:
                    if log_cb:
                        await log_cb(f"{prefix} ⏳ 休息 2 秒后重试...")
                    await asyncio.sleep(2)

        if log_cb:
            await log_cb(f"{prefix} 😭 {max_retries} 次尝试全部失败，放弃该页。")
        return {"html": "", "url": target_url, "status": "error_all_failed"}

    async def scrape_product_page(self, product_url: str) -> dict:
        """
        抓取 NOON 商品详情页
        
        :param product_url: 完整商品详情页 URL
        :return: {"html": str, "url": str, "status": str}
        """
        params = {
            "api_key": self.api_key,
            "url": product_url,
            "render": "true",
            "country_code": "ae",
            "premium": "true",
        }

        logger.info(f"[ScraperAPI] 抓取商品详情: {product_url}")

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                resp = await client.get(self.api_url, params=params)
                resp.raise_for_status()
                return {"html": resp.text, "url": product_url, "status": "success"}
            except Exception as e:
                logger.error(f"[ScraperAPI] 商品详情抓取失败: {e}")
                return {"html": "", "url": product_url, "status": f"error: {e}"}


def parse_noon_search_html(html: str, query: str = "") -> list[dict]:
    """
    从 NOON 搜索结果页 HTML 中提取商品数据
    NOON 的商品卡片通常以 productContainer 或特定 data 属性标识

    :param html: 渲染后的完整 HTML
    :param query: 搜索关键词，用于兜底分类
    :return: 提取的商品列表
    """
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    products = []

    # ── 策略 1: 尝试从 <script> 标签中提取 JSON 数据 (SSR/Next.js) ──
    import json
    for script in soup.find_all("script"):
        text = script.string or ""
        if '"hits"' in text or '"products"' in text or '"items"' in text:
            try:
                # 尝试直接解析整个 script 内容
                data = json.loads(text)
                items = _extract_items_from_json(data)
                if items:
                    logger.info(f"[Parser] 从 script JSON 中提取到 {len(items)} 个商品")
                    return items
            except json.JSONDecodeError:
                # 尝试从 __NEXT_DATA__ 等结构中提取
                pass

    # ── 策略 2: 尝试提取 __NEXT_DATA__ (TanStack/React) ──
    next_data_script = soup.find("script", {"id": "__NEXT_DATA__"})
    if next_data_script and next_data_script.string:
        try:
            next_data = json.loads(next_data_script.string)
            items = _extract_items_from_json(next_data)
            if items:
                logger.info(f"[Parser] 从 __NEXT_DATA__ 中提取到 {len(items)} 个商品")
                return items
        except Exception as e:
            logger.warning(f"[Parser] __NEXT_DATA__ 解析失败: {e}")

    # ── 策略 2.5: 尝试提取 TanStack Router __TSR__ (最新的 NOON 架构) ──
    import re
    if 'hits:' in html and 'catalog_sku:' in html:
        try:
            tsr_products = []
            # NOON TanStack Router inlines hits as JS object chunks
            chunks = html.split('catalog_sku:"')[1:]
            for chunk in chunks:
                # 扩大截断范围以捕获 brand/sale_price/nudges 等字段
                chunk = chunk[:5000]

                sku_match = re.search(r'^([^"]+)"', chunk)
                if not sku_match: continue
                sku = sku_match.group(1).split("-")[0]

                name_match = re.search(r'name:"([^"\\]*(?:\\.[^"\\]*)*)"', chunk)
                name = name_match.group(1) if name_match else ""

                # sale_price 是实际售价，price 是原价
                sale_price_match = re.search(r'sale_price:([\d\.]+)', chunk)
                price_match = re.search(r',price:([\d\.]+)', chunk)
                sale_price = float(sale_price_match.group(1)) if sale_price_match else None
                original_price = float(price_match.group(1)) if price_match else None

                # 如果没有 sale_price，用 price 作为售价
                price = sale_price if sale_price else original_price

                image_match = re.search(r'image_url:"([^"]+)"', chunk)
                image_url = image_match.group(1) if image_match else ""

                rating_match = re.search(r'product_rating:[^\{]*\{best_rating:([\d\.]+),count:(\d+)', chunk)
                review_count = int(rating_match.group(2)) if rating_match else None
                rating = float(rating_match.group(1)) if rating_match else None

                brand_match = re.search(r'brand:"([^"\\]*(?:\\.[^"\\]*)*)"', chunk)
                brand = brand_match.group(1) if brand_match else ""

                store_match = re.search(r'store_name:"([^"\\]*(?:\\.[^"\\]*)*)"', chunk)
                seller_name = store_match.group(1) if store_match else ""

                # 从 nudges 提取品类名，如 "#1 in Egg Cooker" → "Egg Cooker"
                category = ""
                nudge_match = re.search(r'#\d+\s+in\s+([^\"]+)"', chunk)
                if nudge_match:
                    category = nudge_match.group(1).strip()
                elif query:
                    import re
                    q = query.strip()
                    if not re.match(r'^[nN][a-zA-Z0-9]{6,20}$', q):
                        category = q

                # 从 nudges 提取近期销量，如 "60+ sold recently" → 60
                sold_recently = None
                sold_match = re.search(r'text:"(\d+)\+?\s*sold recently"', chunk)
                if sold_match:
                    sold_recently = int(sold_match.group(1))

                # 计算折扣
                discount_percent = None
                if original_price and price and original_price > price:
                    discount_percent = round((1 - price / original_price) * 100, 1)

                if sku and price is not None:
                    tsr_products.append({
                        "sku": sku,
                        "title": name or "未知商品",
                        "price": price,
                        "original_price": original_price if original_price != price else None,
                        "brand": brand,
                        "category": category,
                        "image_url": image_url,
                        "product_url": f"https://www.noon.com/uae-en/{sku}/p/",
                        "rating": rating,
                        "review_count": review_count,
                        "seller_name": seller_name,
                        "is_express": False,
                        "currency": "AED",
                        "discount_percent": discount_percent,
                        "sold_recently": sold_recently,
                    })
            if tsr_products:
                logger.info(f"[Parser] 从 __TSR__ 中正则提取到 {len(tsr_products)} 个商品")
                return tsr_products
        except Exception as e:
            logger.warning(f"[Parser] __TSR__ 解析失败: {e}")

    # ── 策略 3: DOM 选择器解析商品卡片 ──
    # NOON 的商品链接通常包含 /p/ 路径
    product_links = soup.find_all("a", href=lambda h: h and "/p/" in h)
    seen_skus = set()

    for link in product_links:
        try:
            href = link.get("href", "")
            # 从 URL 提取 SKU: /uae-en/apple-iphone/p/N12345/
            raw_sku = href.rstrip("/").split("/")[-1] if "/p/" in href else ""
            # 去除 query 参数，例如 ?o=...
            sku = raw_sku.split("?")[0] if raw_sku else ""
            
            # 如果没有提取到有意义的 SKU，尝试从 query 参数获取 offer ID
            if not sku and "?o=" in raw_sku:
                sku = "OFFER_" + raw_sku.split("?o=")[-1].split("&")[0]

            if not sku or sku in seen_skus:
                continue
            seen_skus.add(sku)

            # 提取商品信息
            card = link  # 商品卡片容器
            title = _extract_text(card, ["[class*='productTitle']", "[class*='ProductTitle']", "h2", "h3", "span"])
            price_text = _extract_text(card, ["[class*='price']", "[class*='Price']", "[class*='amount']", ".amount"], fallback=False)
            
            price = _parse_price(price_text)
            
            # 提取评价数量
            review_count = None
            import re
            for el in card.find_all(['span', 'div']):
                txt = el.get_text(strip=True)
                # 寻找整个文本刚好是 "(123)" 或 "4.5 (123)" 或带星号图标的形式
                match = re.search(r"^(?:[\d\.]+\s*)?\(([\d,kK\.]+)\)$", txt)
                if match:
                    num_str = match.group(1).replace(",", "").lower()
                    if "k" in num_str:
                        try:
                            review_count = int(float(num_str.replace("k", "")) * 1000)
                            break
                        except ValueError:
                            pass
                    else:
                        try:
                            review_count = int(float(num_str))
                            break
                        except ValueError:
                            pass
                            
            product = {
                "sku": sku,
                "title": title or "未知商品",
                "price": price,
                "original_price": None,
                "brand": "",
                "category": "",
                "image_url": _extract_image(card),
                "product_url": f"https://www.noon.com{href}" if href.startswith("/") else href,
                "rating": None,
                "review_count": review_count,
                "seller_name": "",
                "is_express": "express" in card.get_text().lower(),
                "currency": "AED",
                "discount_percent": None,
            }
            products.append(product)

        except Exception as e:
            logger.warning(f"[Parser] 解析商品卡片失败: {e}")
            continue

    logger.info(f"[Parser] DOM 解析完成，提取到 {len(products)} 个商品")
    return products


def _extract_items_from_json(data: dict, depth: int = 0) -> list[dict]:
    """递归搜索 JSON 数据中的商品列表"""
    if depth > 10:
        return []
    
    products = []

    if isinstance(data, dict):
        # 检查当前层级是否有商品列表
        for key in ("hits", "products", "items", "results", "data"):
            val = data.get(key)
            if isinstance(val, list) and len(val) > 0:
                if isinstance(val[0], dict) and any(
                    k in val[0] for k in ("sku", "title", "name", "price", "id")
                ):
                    for item in val:
                        product = {
                            "sku": str(item.get("sku", item.get("id", ""))),
                            "title": item.get("title", item.get("name", item.get("name_en", ""))),
                            "price": _safe_float(item.get("price", item.get("sale_price"))),
                            "original_price": _safe_float(item.get("was_price", item.get("original_price"))),
                            "brand": item.get("brand", item.get("brand_code", "")),
                            "category": item.get("category", ""),
                            "image_url": item.get("image_key", item.get("image", item.get("image_url", ""))),
                            "product_url": item.get("url", ""),
                            "rating": _safe_float(item.get("rating", item.get("avg_rating"))),
                            "review_count": _safe_int(item.get("review_count", item.get("num_ratings", item.get("rating_count", item.get("ratingCount", item.get("reviews")))))),
                            "seller_name": item.get("seller_name", item.get("store_name", "")),
                            "is_express": bool(item.get("is_express") or item.get("fulfilment_type", "") == "express"),
                            "currency": item.get("currency", "AED"),
                        }
                        # 折扣
                        if product["price"] and product["original_price"] and product["original_price"] > 0:
                            product["discount_percent"] = round(
                                (1 - product["price"] / product["original_price"]) * 100, 1
                            )
                        else:
                            product["discount_percent"] = None

                        if product["sku"]:
                            products.append(product)
                    return products

        # 递归搜索子字典
        for v in data.values():
            found = _extract_items_from_json(v, depth + 1)
            if found:
                return found

    elif isinstance(data, list):
        for item in data:
            found = _extract_items_from_json(item, depth + 1)
            if found:
                return found

    return products


def _extract_text(element, selectors: list[str], fallback: bool = True) -> str:
    """从元素中按优先级尝试多个选择器提取文本"""
    for sel in selectors:
        found = element.select_one(sel)
        if found:
            return found.get_text(strip=True)
    return element.get_text(strip=True)[:100] if (element and fallback) else ""


def _extract_image(element) -> str:
    """从元素中提取图片 URL"""
    img = element.find("img")
    if img:
        return img.get("src", img.get("data-src", ""))
    return ""


def _parse_price(text: str) -> float | None:
    """从价格文本中提取数字"""
    if not text:
        return None
    import re
    match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
    return float(match.group()) if match else None


def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _safe_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None
