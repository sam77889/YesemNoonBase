# noon_scraper — noon.com 商品爬虫模块

基于 `curl_cffi` TLS 指纹模拟的 noon.com 商品爬虫，**无需浏览器**，稳定绕过 Akamai Bot Manager 反爬机制。

## 安装

```bash
pip install -r requirements.txt
```

依赖：`curl_cffi>=0.15.0`、`beautifulsoup4>=4.12.0`、`lxml>=5.0.0`

## 快速开始

### 同步 API

```python
from noon_scraper import NoonScraper

# 方式 1：使用上下文管理器（自动关闭会话）
with NoonScraper() as scraper:
    # 搜索关键词（如「筋膜枪」→ massage gun）
    products = scraper.search("massage gun", max_pages=5)
    for p in products:
        print(f"{p['title']} | {p['price']} {p['currency']} | ⭐{p['rating']}")

# 方式 2：手动管理
scraper = NoonScraper()
products = scraper.crawl_category("electronics-and-mobiles", max_pages=3)
scraper.close()
```

### 异步 API（推荐，详情页并发抓取）

```python
import asyncio
from noon_scraper import AsyncNoonScraper

async def main():
    async with AsyncNoonScraper(concurrency=5) as scraper:
        products = await scraper.search("massage gun", max_pages=10)
        print(f"抓取 {len(products)} 条商品")

asyncio.run(main())
```

## API 文档

### `NoonScraper`（同步）

#### 构造函数

```python
NoonScraper(
    impersonate="firefox",  # TLS 指纹（firefox 实测有效，chrome 会被拦截）
    timeout=30,             # 请求超时（秒）
    retries=3,              # 失败重试次数
    retry_delay=2.0,        # 重试间隔（秒）
)
```

#### 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `search(keyword, max_pages=10, page_delay=1.0)` | `keyword`: 搜索词（英文）<br>`max_pages`: 最多翻页数<br>`page_delay`: 翻页间隔 | `list[dict]` | 搜索关键词抓取商品 |
| `crawl_category(category, max_pages=5, max_products_per_page=20, page_delay=1.0)` | `category`: 分类路径<br>`max_products_per_page`: 每页商品上限 | `list[dict]` | 分类页抓取商品 |
| `fetch_product(url)` | `url`: 商品详情页 URL | `dict \| None` | 抓取单个商品 |
| `fetch_page(url)` | `url`: 页面 URL | `str \| None` | 获取页面 HTML |
| `close()` | — | — | 关闭 HTTP 会话 |

---

### `AsyncNoonScraper`（异步）

#### 构造函数

```python
AsyncNoonScraper(
    impersonate="firefox",
    timeout=30,
    retries=3,
    retry_delay=2.0,
    concurrency=5,          # 详情页并发数
)
```

#### 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `await search(keyword, max_pages=10, page_delay=1.0)` | 同同步版 | `list[dict]` | 异步搜索抓取，详情页并发 |
| `await crawl_category(...)` | 同同步版 | `list[dict]` | 异步分类抓取，详情页并发 |
| `await fetch_product(url)` | `url` | `dict \| None` | 异步抓取单个商品 |
| `await fetch_page(url)` | `url` | `str \| None` | 异步获取页面 HTML |
| `await close()` | — | — | 关闭异步会话 |

---

### 工具函数

| 函数 | 说明 |
|------|------|
| `extract_product_links(html, base_url)` | 从列表页/搜索页 HTML 提取商品链接 |
| `parse_product(html, url)` | 从详情页 HTML 提取结构化数据 |
| `build_page_url(base_url, page)` | 构造分页 URL（保留 query 参数） |

## 返回数据结构

每个商品为一个字典，包含 11 个字段：

```python
{
    "url": "https://www.noon.com/uae-en/.../N70017491V/p/",
    "title": "Osmo Pocket 3 Vlogging Camera...",
    "brand": "dji",
    "price": "1524.00",
    "currency": "AED",
    "rating": 4.5,            # 评分（部分商品可能为 None）
    "review_count": 8319,     # 评论数（部分商品可能为 None）
    "availability": "InStock",
    "seller": "noon",
    "sku": "N70017491V",
    "image": "https://f.nooncdn.com/p/...",
}
```

**字段填充率**（实测 96 条商品）：
- `url`/`title`/`brand`/`price`/`currency`/`availability`/`seller`/`sku`/`image`：**100%**
- `rating`/`review_count`：**~93%**（少数无评论商品为 None）

## 分类路径参考

| 分类 | `category` 参数值 |
|------|------|
| 电子产品 | `electronics-and-mobiles` |
| 家居 | `home-kitchen` |
| 美容 | `beauty-personal-care` |
| 时尚 | `fashion` |
| 玩具 | `toys-games` |

> 完整分类可在浏览器中访问 `https://www.noon.com/uae-en/` 查看各分类的 URL 路径。

## 技术原理

### 为什么用 curl_cffi 而不是浏览器？

noon.com 使用 **Akamai Bot Manager** 反爬。实测结果：

| 方案 | 结果 |
|------|------|
| 无头浏览器（Playwright/StealthyFetcher） | ❌ 返回 200 但内容为空（0 字节） |
| 纯 httpx（无 TLS 指纹） | ❌ 被拦截，请求失败 |
| curl_cffi + `impersonate="firefox"` | ✅ 稳定绕过，101 请求 0 拦截 |

`curl_cffi` 模拟真实浏览器的 TLS 指纹（JA3/JA4），Akamai 无法区分其与真实 Firefox 的差异。

### 为什么 `impersonate="firefox"` 而不是 `chrome`？

实测 `chrome` 指纹会被 Akamai 识别返回空页面，`firefox` 指纹可成功获取完整内容。具体原因未知，可能是 Akamai 对 chrome 指纹的检测规则更严格。

## 注意事项

1. **关键词语言**：`uae-en` 站点为英文环境，中文关键词（如「筋膜枪」）需转译为英文（如 `massage gun`）。
2. **翻页延时**：默认 `page_delay=1.0` 秒，降低触发限流风险。如遇 IP 被临时封禁，增大延时或等待恢复。
3. **并发控制**：异步模式默认 `concurrency=5`，可根据网络情况调整。
4. **断点续爬**：如需中断恢复，建议在外部记录已抓取的 URL 集合，恢复时跳过。

## 与 noon_base 项目集成

本模块可独立使用，也可与 `noon_api` 后端集成：

```python
# 在 noon_api 的 service 中调用
from noon_scraper import AsyncNoonScraper

async def scrape_with_fetcher(keyword: str):
    async with AsyncNoonScraper() as scraper:
        products = await scraper.search(keyword, max_pages=10)
        # 转换为数据库模型并入库
        return products
```

作为 ScraperAPI/Oxylabs 的替代方案，本模块**无需付费 API**，直接从本地发起请求。
