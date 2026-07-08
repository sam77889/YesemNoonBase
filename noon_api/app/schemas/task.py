"""
NOON 数据分析系统 - 任务相关 Pydantic 接口模型
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    """创建爬虫任务的请求体"""
    task_type: str = "SEARCH"          # SEARCH / PRODUCT_DETAIL / CATEGORY
    query: str                          # 搜索关键词或目标 URL
    country: str = "uae"               # uae / saudi / egypt
    language: str = "en"                # en / ar
    pages: int = 1                      # 连续抓取的深度页数
    provider: Optional[str] = None     # 抓取引擎: fetcher(本地直连) / scraperapi / oxylabs；None=用环境变量默认


class TaskResponse(BaseModel):
    """爬虫任务响应体"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: Optional[str] = None
    task_type: str
    query: str
    country: str
    language: str
    status: str
    result_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class OxylabsWebhookPayload(BaseModel):
    """
    Oxylabs Webhook 回调的数据结构
    当 Oxylabs 完成抓取后，会向我们的 Webhook 端点 POST 此数据
    """
    job_id: str                                     # Oxylabs 任务 ID
    status: str = "done"                            # 任务状态
    results: Optional[list[dict]] = None            # 抓取结果列表
    error: Optional[str] = None                     # 错误信息（失败时）
