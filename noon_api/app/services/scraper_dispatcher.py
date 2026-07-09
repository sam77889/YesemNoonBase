"""
NOON 数据分析系统 - 统一爬虫调度器
根据配置的 SCRAPER_PROVIDER 自动选择 ScraperAPI 或 Oxylabs 进行数据采集
实现策略模式，对上层业务透明
"""
import logging
import asyncio
import statistics
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.task import ScrapingTask
from app.services.scraperapi import ScraperAPIClient, parse_noon_search_html
from app.services.keyword_service import get_keyword_service
from app.services.oxylabs import OxylabsClient
from app.services.etl import parse_search_results, save_products_to_db
from app.services.price_monitor import check_price_alerts

logger = logging.getLogger(__name__)
settings = get_settings()


async def _clean_products(products: list[dict], query: str, log_cb=None) -> list[dict]:
    """两阶段清洗：关键词命中过滤 + 全局中位数离群点过滤。

    与 scraperapi 分支内置的清洗逻辑保持一致，供本地 fetcher 复用。
    """
    # 清洗 1: 关键词命中过滤（标题须包含任一查询词；无标题则保留）
    query_words = set(query.lower().split())
    if query_words:
        products = [
            p for p in products
            if not p.get("title") or 
               any(qw in p["title"].lower() for qw in query_words) or 
               (p.get("sku") and p["sku"].lower() == query.lower())
        ]

    # 清洗 2: 全局中位数离群点过滤
    if products:
        prices = [p["price"] for p in products if p.get("price")]
        if len(prices) >= 3:
            median_price = statistics.median(prices)
            lower_bound = median_price * 0.2
            upper_bound = median_price * 4.0
            filtered = [
                p for p in products
                if not p.get("price") or lower_bound <= p["price"] <= upper_bound
            ]
            removed = len(products) - len(filtered)
            products = filtered
            if removed > 0 and log_cb:
                await log_cb(f"\n🧹 全局清洗：已自动剔除 {removed} 个价格异常(配件/非目标)商品，中位数参考: {median_price:.1f}")
    return products


async def run_search_scrape(
    db: AsyncSession,
    query: str,
    country: str = "uae",
    language: str = "en",
    pages: int = 1,
    provider: str | None = None,
    job_id: str | None = None,
) -> dict:
    """
    执行一次完整的搜索抓取流程（端到端），支持深潜抓取多页

    :param provider: 抓取引擎 fetcher(本地直连) / scraperapi / oxylabs；
                     None 时回退到环境变量 SCRAPER_PROVIDER
    """
    # ── 关键词翻译：中文 → 英文 ──
    keyword_service = get_keyword_service()
    translated_query = keyword_service.translate(query)
    if translated_query != query:
        logger.info(f"[调度器] 关键词翻译: {query} → {translated_query}")
        query = translated_query

    provider = (provider or settings.SCRAPER_PROVIDER).lower()
    logger.info(f"[调度器] 开始搜索抓取: query={query}, provider={provider}, pages={pages}")

    # ── 1. 创建任务记录 ──
    task = ScrapingTask(
        task_type="SEARCH",
        query=query,
        country=country,
        language=language,
        status="PROCESSING",
        job_id=job_id or f"{provider}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{query}",
    )
    db.add(task)
    await db.flush()

    all_products = []
    error_msg = None
    db_lock = asyncio.Lock()

    async def _log_cb(msg: str):
        async with db_lock:
            if not task.error_message:
                task.error_message = msg
            else:
                task.error_message += f"\n{msg}"
            logger.info(f"[Task {task.job_id}] {msg}")
            await db.commit()

    try:
        if provider == "scraperapi":
            client = ScraperAPIClient()
            sem = asyncio.Semaphore(3) # 最大并发限制为 3
            
            async def _scrape_page(current_page: int):
                async with sem:
                    result = await client.scrape_search_page(query, country, language, log_cb=_log_cb, page=current_page)
                    
                    if result["status"] == "success" and result["html"]:
                        await _log_cb(f"[P{current_page}] 开始解析本页数据...")
                        page_products = parse_noon_search_html(result["html"], query=query)
                        await _log_cb(f"[P{current_page}] 本页提取到 {len(page_products)} 个商品。")
                        
                        # 清洗 1: 关键词拦截
                        query_words = set(query.lower().split())
                        if query_words:
                            page_products = [
                                p for p in page_products 
                                if not p.get("title") or any(qw in p["title"].lower() for qw in query_words)
                            ]
                        return page_products
                    return []
            
            if pages > 1:
                await _log_cb(f"🚀 初始化多页并行收割引擎，总任务数: {pages}，最大并发线程: 3")
                
            tasks_list = [_scrape_page(p) for p in range(1, pages + 1)]
            results = await asyncio.gather(*tasks_list)
            
            for page_results in results:
                all_products.extend(page_results)
            
            # 清洗 2: 全局中位数离群点拦截 (基于所有页的数据)
            if all_products:
                prices = [p["price"] for p in all_products if p.get("price")]
                if len(prices) >= 3:
                    median_price = statistics.median(prices)
                    lower_bound = median_price * 0.2
                    upper_bound = median_price * 4.0
                    
                    filtered_products = []
                    for p in all_products:
                        if not p.get("price"):
                            filtered_products.append(p)
                        elif lower_bound <= p["price"] <= upper_bound:
                            filtered_products.append(p)
                    
                    removed = len(all_products) - len(filtered_products)
                    all_products = filtered_products
                    if removed > 0:
                        await _log_cb(f"\n🧹 全局清洗：已自动剔除 {removed} 个价格异常(配件/非目标)商品，中位数参考: {median_price:.1f}")

                await _log_cb(f"所有页面并发收割完毕！最终保留 {len(all_products)} 个高质量商品准备入库！")
                
        elif provider == "fetcher":
            # ── 本地直连爬虫（curl_cffi firefox 指纹，无需付费 API）──
            try:
                from app.services.fetcher_scraper import run_fetcher_scrape
            except ImportError as ie:
                error_msg = f"本地采集模块加载失败（请在 noon_api venv 安装 curl_cffi）: {ie}"
                logger.error(f"[调度器] {error_msg}")
            else:
                if pages > 1:
                    await _log_cb(f"🦊 初始化本地直搜，总页数: {pages}")
                raw_products = await run_fetcher_scrape(query, country, language, pages, log_cb=_log_cb)
                all_products = await _clean_products(raw_products, query, _log_cb)
                if all_products:
                    await _log_cb(f"🦊 本地采集收割完毕！最终保留 {len(all_products)} 个高质量商品准备入库！")

        elif provider == "oxylabs":
            # ── Oxylabs 模式：同步实时查询（非 Webhook） ──
            client = OxylabsClient()
            result = await client.submit_search_task(query, country, language)
            
            # Oxylabs realtime API 直接返回结果
            if "results" in result:
                all_products = parse_search_results(result["results"])
            else:
                error_msg = f"Oxylabs 未返回结果: {result}"
        else:
            error_msg = f"未知的 SCRAPER_PROVIDER: {provider}"

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[调度器] 抓取异常: {e}")

    # ── 2. 入库 ──
    saved_count = 0
    alerts = []

    if all_products:
        # 入库前统一打上搜索关键词作为分类标签（小写化保证一致可追溯）
        import re
        is_sku_query = bool(re.match(r'^[nN][a-zA-Z0-9]{6,20}$', query.strip()))
        for p in all_products:
            if not is_sku_query:
                p['category'] = query.lower()
            elif is_sku_query and p.get('category') == query.lower():
                p['category'] = ""
        saved_count = await save_products_to_db(db, all_products)
        task.result_count = saved_count
        task.status = "SUCCESS"
        task.completed_at = datetime.utcnow()

        # ── 3. 价格预警 ──
        for p in all_products:
            if p.get("price") and p.get("sku"):
                alert = await check_price_alerts(db, p["sku"], p["price"])
                if alert:
                    alerts.append(alert)
    else:
        task.status = "FAILED"
        if error_msg:
            task.error_message = task.error_message + f"\n{error_msg}" if task.error_message else error_msg
        task.completed_at = datetime.utcnow()

    await db.commit()

    summary = {
        "job_id": task.job_id,
        "provider": provider,
        "query": query,
        "status": task.status,
        "products_found": len(all_products),
        "products_saved": saved_count,
        "alerts": alerts,
        "error": error_msg,
    }

    logger.info(f"[调度器] 抓取完成: {summary}")
    return summary
