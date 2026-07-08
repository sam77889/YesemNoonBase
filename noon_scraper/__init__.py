"""
noon_scraper — noon.com 商品爬虫可移植模块

基于 curl_cffi TLS 指纹模拟，绕过 Akamai Bot Manager 反爬机制。
无需浏览器，纯 HTTP 请求，支持同步和异步两种调用方式。

快速开始::
    from noon_scraper import NoonScraper

    scraper = NoonScraper()
    products = scraper.search("massage gun", max_pages=5)
    for p in products:
        print(p["title"], p["price"], p["rating"])

异步方式::
    import asyncio
    from noon_scraper import AsyncNoonScraper

    async def main():
        async with AsyncNoonScraper() as scraper:
            products = await scraper.search("massage gun")
            print(f"抓取 {len(products)} 条")

    asyncio.run(main())
"""

from .fetcher import NoonScraper, AsyncNoonScraper
from .fetcher import extract_product_links, parse_product, build_page_url

__version__ = "1.0.0"
__all__ = [
    "NoonScraper",
    "AsyncNoonScraper",
    "extract_product_links",
    "parse_product",
    "build_page_url",
]
