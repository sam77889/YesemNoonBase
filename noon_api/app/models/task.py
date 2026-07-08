"""
NOON 数据分析系统 - 爬虫任务 ORM 模型
ScrapingTask: 记录每次下发给 Oxylabs 的抓取任务及其状态
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text
from app.models.database import Base


class ScrapingTask(Base):
    """
    爬虫任务表
    每次向 Oxylabs API 下发一个抓取请求时，创建一条记录
    Webhook 回调时更新任务状态
    """
    __tablename__ = "scraping_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(100), unique=True, index=True, comment="Oxylabs 返回的任务 ID")
    task_type = Column(String(50), nullable=False, comment="任务类型: SEARCH / PRODUCT_DETAIL / CATEGORY")
    query = Column(String(500), nullable=False, comment="搜索关键词或目标 URL")
    country = Column(String(10), default="uae", comment="目标国家站点: uae / saudi / egypt")
    language = Column(String(10), default="en", comment="语言: en / ar")
    status = Column(String(20), default="PENDING", comment="任务状态: PENDING / PROCESSING / SUCCESS / FAILED")
    result_count = Column(Integer, nullable=True, comment="返回结果数量")
    error_message = Column(Text, nullable=True, comment="失败时的错误信息")
    created_at = Column(DateTime, default=datetime.utcnow, comment="任务创建时间")
    completed_at = Column(DateTime, nullable=True, comment="任务完成时间")

    def __repr__(self):
        return f"<ScrapingTask job_id={self.job_id} status={self.status}>"
