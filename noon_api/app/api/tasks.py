"""
NOON 数据分析系统 - 爬虫任务管理 API
创建、查询抓取任务（支持 ScraperAPI / Oxylabs 自动切换）
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db, async_session_maker
from app.models.task import ScrapingTask
from app.schemas.task import TaskCreate, TaskResponse
from app.services.scraper_dispatcher import run_search_scrape
from fastapi import BackgroundTasks
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["爬虫任务"])


@router.post("/search")
async def create_search_task(
    task_data: TaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    创建任务并放入后台执行
    """
    job_id = f"scraperapi-{task_data.query}-{logger.name[-4:]}" # Simplified job ID generator for fast creation, actually let dispatcher generate it?
    # Better: let dispatcher handle it but we want to return something fast.
    
    async def run_in_background(query: str, country: str, language: str, pages: int, provider: str | None):
        async with async_session_maker() as bg_db:
            await run_search_scrape(bg_db, query, country, language, pages, provider=provider)

    background_tasks.add_task(
        run_in_background,
        task_data.query,
        task_data.country,
        task_data.language,
        task_data.pages,
        task_data.provider
    )
    
    return {"message": "Scraping task started in background", "query": task_data.query}


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str = Query(None, description="按状态筛选"),
    db: AsyncSession = Depends(get_db),
):
    """获取任务列表（分页）"""
    stmt = select(ScrapingTask).offset(skip).limit(limit).order_by(ScrapingTask.created_at.desc())
    if status:
        stmt = stmt.where(ScrapingTask.status == status)
    result = await db.execute(stmt)
    tasks = result.scalars().all()
    return tasks


@router.get("/{job_id}", response_model=TaskResponse)
async def get_task_detail(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """查询单个任务状态"""
    stmt = select(ScrapingTask).where(ScrapingTask.job_id == job_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {job_id} 未找到")
    return task
