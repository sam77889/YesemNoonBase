"""
NOON 数据分析系统 - Oxylabs API 客户端
负责向 Oxylabs Web Scraper API 下发抓取任务
支持搜索结果抓取、商品详情页抓取，均使用异步 Webhook 回调模式
"""
import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class OxylabsClient:
    """Oxylabs Web Scraper API 客户端"""

    def __init__(self):
        self.username = settings.OXYLABS_USERNAME
        self.password = settings.OXYLABS_PASSWORD
        self.api_url = settings.OXYLABS_API_URL

    async def submit_search_task(
        self,
        query: str,
        country: str = "uae",
        language: str = "en",
        webhook_url: str = "",
    ) -> dict:
        """
        下发 NOON 搜索结果抓取任务
        :param query: 搜索关键词，如 "iphone"
        :param country: 站点国家，如 uae / saudi / egypt
        :param language: 语言，如 en / ar
        :param webhook_url: 我们系统的 Webhook 接收地址
        :return: Oxylabs 返回的任务信息（含 job_id）
        """
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        url = f"https://www.noon.com/{country}-{language}/search/?q={encoded_query}"
        payload = {
            "source": "universal_ecommerce",
            "url": url,
            "render": "html",
            "callback_url": webhook_url,
            "parse": True,
        }
        logger.info(f"[Oxylabs] 下发搜索任务: query={query}, country={country}, url={url}")

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    self.api_url,
                    json=payload,
                    auth=(self.username, self.password),
                )
                resp.raise_for_status()
                result = resp.json()
                logger.info(f"[Oxylabs] 任务已受理: {result.get('id', 'N/A')}")
                return result
            except httpx.HTTPStatusError as e:
                logger.error(f"[Oxylabs] API 请求失败: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"[Oxylabs] 请求异常: {e}")
                raise

    async def submit_product_task(
        self,
        product_url: str,
        webhook_url: str = "",
    ) -> dict:
        """
        下发单个商品详情页抓取任务
        :param product_url: NOON 商品详情页完整 URL
        :param webhook_url: Webhook 回调地址
        :return: 任务信息
        """
        payload = {
            "source": "universal_ecommerce",
            "url": product_url,
            "render": "html",
            "callback_url": webhook_url,
            "parse": True,
        }
        logger.info(f"[Oxylabs] 下发商品详情任务: {product_url}")

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    self.api_url,
                    json=payload,
                    auth=(self.username, self.password),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"[Oxylabs] 商品详情任务失败: {e}")
                raise

    async def get_task_status(self, job_id: str) -> dict:
        """
        查询任务状态（用于轮询模式，非 Webhook 时的备用方案）
        :param job_id: Oxylabs 任务 ID
        :return: 任务状态信息
        """
        status_url = f"{self.api_url}/{job_id}"
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await client.get(
                    status_url,
                    auth=(self.username, self.password),
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"[Oxylabs] 查询任务状态失败: job_id={job_id}, error={e}")
                raise
