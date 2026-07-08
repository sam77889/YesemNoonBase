"""
noon_scraper/fetcher.py
=======================
noon.com 商品爬虫核心模块 — 基于 curl_cffi TLS 指纹模拟，无需浏览器。

核心原理：
  noon.com 使用 Akamai Bot Manager 反爬。实测发现：
  - 无头浏览器（Playwright/StealthyFetcher）：被识别，返回空内容
  - 纯 httpx（无 TLS 指纹）：被识别，请求失败
  - curl_cffi + impersonate="firefox"：稳定绕过（模拟真实浏览器 TLS 指纹 JA3/JA4）

依赖：curl_cffi, beautifulsoup4, lxml
"""

import json
import time
import asyncio
from urllib.parse import quote, urlparse, parse_qs, urlencode, urlunparse

from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup

__all__ = ["NoonScraper", "AsyncNoonScraper"]


# ============================================================
# 数据提取工具函数
# ============================================================

def extract_product_links(html: str, base_url: str = "https://www.noon.com") -> list[str]:
    """从列表页/搜索页 HTML 中提取商品详情页链接。

    noon.com 商品 URL 格式: /p/<id>/N<id>
    """
    soup = BeautifulSoup(html, "lxml")
    links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/p/" in href and "/N" in href:
            abs_url = href if href.startswith("http") else base_url.rstrip("/") + href
            links.add(abs_url)
    return list(links)


def parse_product(html: str, url: str = "") -> dict:
    """从商品详情页 HTML 提取结构化数据。

    优先从 <script type="application/ld+json"> 中解析 Product schema，
    CSS 选择器作为降级方案。

    返回字段: url, title, brand, price, currency, rating, review_count,
             availability, seller, sku, image
    """
    item = {
        "url": url, "title": None, "brand": None,
        "price": None, "currency": None, "rating": None,
        "review_count": None, "availability": None,
        "seller": None, "sku": None, "image": None,
    }

    soup = BeautifulSoup(html, "lxml")

    # 优先从 JSON-LD 提取标准 Product schema
    for script in soup.find_all("script", {"type": "application/ld+json"}):
        text = script.get_text()
        if not text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue

        # JSON-LD 可能是列表或含 @graph
        if isinstance(data, list):
            candidates = data
        elif isinstance(data, dict) and "@graph" in data:
            candidates = data["@graph"] if isinstance(data["@graph"], list) else [data["@graph"]]
        else:
            candidates = [data]

        product = next(
            (e for e in candidates if isinstance(e, dict) and e.get("@type") == "Product"),
            None,
        )
        if not product:
            continue

        item["title"] = product.get("name")
        brand_info = product.get("brand", {})
        item["brand"] = brand_info.get("name") if isinstance(brand_info, dict) else brand_info
        item["sku"] = product.get("sku")

        offers = product.get("offers", [])
        offer = offers[0] if isinstance(offers, list) and offers else offers
        if isinstance(offer, dict):
            item["price"] = offer.get("price")
            item["currency"] = offer.get("priceCurrency", "AED")
            avail = offer.get("availability", "")
            item["availability"] = avail.split("/")[-1] if avail else None
            seller = offer.get("seller", {})
            item["seller"] = seller.get("name") if isinstance(seller, dict) else seller

        rating = product.get("aggregateRating", {})
        if isinstance(rating, dict):
            item["rating"] = rating.get("ratingValue")
            item["review_count"] = rating.get("reviewCount")

        image = product.get("image")
        if isinstance(image, list):
            item["image"] = image[0] if image else None
        elif isinstance(image, str):
            item["image"] = image
        break

    # 降级：CSS 选择器
    if not item["title"]:
        h1 = soup.find("h1")
        if h1:
            item["title"] = h1.get_text(strip=True)

    return item


def build_page_url(base_url: str, page: int) -> str:
    """构造分页 URL，保留原有 query 参数（如搜索的 q）。"""
    if page <= 1:
        return base_url
    parsed = urlparse(base_url)
    params = parse_qs(parsed.query)
    params["page"] = [str(page)]
    new_query = urlencode({k: v[0] for k, v in params.items()})
    return urlunparse(parsed._replace(query=new_query))


def get_current_page(url: str) -> int:
    """从 URL 解析当前页码。"""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    if "page" in params:
        try:
            return int(params["page"][0])
        except (ValueError, IndexError):
            pass
    return 1


# ============================================================
# 同步爬虫
# ============================================================

class NoonScraper:
    """noon.com 同步商品爬虫。

    基于 curl_cffi 模拟 firefox TLS 指纹，绕过 Akamai Bot Manager。

    示例::
        scraper = NoonScraper()
        products = scraper.search("massage gun", max_pages=5)
        for p in products:
            print(p["title"], p["price"], p["rating"])
    """

    BASE_URL = "https://www.noon.com/uae-en"
    DOMAIN = "https://www.noon.com"  # 用于商品链接拼接（href 已含 /uae-en/ 路径）

    def __init__(
        self,
        impersonate: str = "firefox",
        timeout: int = 30,
        retries: int = 3,
        retry_delay: float = 2.0,
    ):
        self.impersonate = impersonate
        self.timeout = timeout
        self.retries = retries
        self.retry_delay = retry_delay
        self._session = cffi_requests.Session(impersonate=impersonate)

    def fetch_page(self, url: str) -> str | None:
        """获取页面 HTML，失败返回 None。内置重试。"""
        for attempt in range(self.retries):
            try:
                resp = self._session.get(url, timeout=self.timeout, allow_redirects=True)
                if resp.status_code == 200 and len(resp.text) > 1000:
                    return resp.text
                if attempt < self.retries - 1:
                    time.sleep(self.retry_delay)
            except Exception:
                if attempt < self.retries - 1:
                    time.sleep(self.retry_delay)
        return None

    def fetch_product(self, url: str) -> dict | None:
        """抓取单个商品详情页，返回结构化数据。"""
        html = self.fetch_page(url)
        if not html:
            return None
        return parse_product(html, url)

    def search(
        self,
        keyword: str,
        max_pages: int = 10,
        page_delay: float = 1.0,
    ) -> list[dict]:
        """搜索关键词并抓取商品。

        Args:
            keyword: 搜索关键词（英文，如 "massage gun"）
            max_pages: 最多翻页数
            page_delay: 翻页间隔（秒）

        Returns:
            商品数据列表，每项含 title/brand/price/rating 等 11 个字段
        """
        search_url = f"{self.BASE_URL}/search?q={quote(keyword)}"
        return self._crawl(search_url, max_pages, max_products_per_page=None, page_delay=page_delay)

    def crawl_category(
        self,
        category: str = "electronics-and-mobiles",
        max_pages: int = 5,
        max_products_per_page: int = 20,
        page_delay: float = 1.0,
    ) -> list[dict]:
        """抓取分类页商品。

        Args:
            category: 分类路径（如 "electronics-and-mobiles"）
            max_pages: 最多翻页数
            max_products_per_page: 每页最多抓取的商品数（None=全部）
            page_delay: 翻页间隔（秒）
        """
        category_url = f"{self.BASE_URL}/{category}/"
        return self._crawl(category_url, max_pages, max_products_per_page, page_delay)

    def _crawl(
        self,
        start_url: str,
        max_pages: int,
        max_products_per_page: int | None,
        page_delay: float,
    ) -> list[dict]:
        """内部翻页抓取逻辑。"""
        results = []
        seen_urls = set()

        for page in range(1, max_pages + 1):
            url = build_page_url(start_url, page)
            html = self.fetch_page(url)
            if not html:
                break

            links = extract_product_links(html, self.DOMAIN)
            if not links:
                break

            new_links = [l for l in links if l not in seen_urls]
            if not new_links:
                break
            seen_urls.update(new_links)

            limit = max_products_per_page or len(new_links)
            for link in new_links[:limit]:
                product = self.fetch_product(link)
                if product:
                    results.append(product)

            if page < max_pages:
                time.sleep(page_delay)

        return results

    def close(self):
        """关闭 HTTP 会话。"""
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# ============================================================
# 异步爬虫
# ============================================================

class AsyncNoonScraper:
    """noon.com 异步商品爬虫，支持并发抓取详情页。

    示例::
        import asyncio
        scraper = AsyncNoonScraper()
        products = asyncio.run(scraper.search("massage gun", max_pages=5))
    """

    BASE_URL = "https://www.noon.com/uae-en"
    DOMAIN = "https://www.noon.com"

    def __init__(
        self,
        impersonate: str = "firefox",
        timeout: int = 30,
        retries: int = 3,
        retry_delay: float = 2.0,
        concurrency: int = 5,
    ):
        self.impersonate = impersonate
        self.timeout = timeout
        self.retries = retries
        self.retry_delay = retry_delay
        self.concurrency = concurrency
        self._session: cffi_requests.AsyncSession | None = None

    async def _get_session(self) -> cffi_requests.AsyncSession:
        if self._session is None:
            self._session = cffi_requests.AsyncSession(impersonate=self.impersonate)
        return self._session

    async def fetch_page(self, url: str) -> str | None:
        """异步获取页面 HTML，失败返回 None。内置重试。"""
        session = await self._get_session()
        for attempt in range(self.retries):
            try:
                resp = await session.get(url, timeout=self.timeout, allow_redirects=True)
                if resp.status_code == 200 and len(resp.text) > 1000:
                    return resp.text
                if attempt < self.retries - 1:
                    await asyncio.sleep(self.retry_delay)
            except Exception:
                if attempt < self.retries - 1:
                    await asyncio.sleep(self.retry_delay)
        return None

    async def fetch_product(self, url: str) -> dict | None:
        """异步抓取单个商品详情页。"""
        html = await self.fetch_page(url)
        if not html:
            return None
        return parse_product(html, url)

    async def search(
        self,
        keyword: str,
        max_pages: int = 10,
        page_delay: float = 1.0,
    ) -> list[dict]:
        """异步搜索关键词并抓取商品，详情页并发抓取。"""
        search_url = f"{self.BASE_URL}/search?q={quote(keyword)}"
        return await self._crawl(search_url, max_pages, None, page_delay)

    async def crawl_category(
        self,
        category: str = "electronics-and-mobiles",
        max_pages: int = 5,
        max_products_per_page: int = 20,
        page_delay: float = 1.0,
    ) -> list[dict]:
        """异步抓取分类页商品，详情页并发抓取。"""
        category_url = f"{self.BASE_URL}/{category}/"
        return await self._crawl(category_url, max_pages, max_products_per_page, page_delay)

    async def _crawl(
        self,
        start_url: str,
        max_pages: int,
        max_products_per_page: int | None,
        page_delay: float,
    ) -> list[dict]:
        """内部异步翻页抓取逻辑，详情页并发。"""
        results = []
        seen_urls = set()
        semaphore = asyncio.Semaphore(self.concurrency)

        for page in range(1, max_pages + 1):
            url = build_page_url(start_url, page)
            html = await self.fetch_page(url)
            if not html:
                break

            links = extract_product_links(html, self.DOMAIN)
            if not links:
                break

            new_links = [l for l in links if l not in seen_urls]
            if not new_links:
                break
            seen_urls.update(new_links)

            limit = max_products_per_page or len(new_links)
            batch = new_links[:limit]

            async def worker(link: str) -> dict | None:
                async with semaphore:
                    return await self.fetch_product(link)

            batch_results = await asyncio.gather(*(worker(l) for l in batch))
            results.extend(r for r in batch_results if r)

            if page < max_pages:
                await asyncio.sleep(page_delay)

        return results

    async def close(self):
        """关闭异步 HTTP 会话。"""
        if self._session:
            await self._session.close()
            self._session = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()
