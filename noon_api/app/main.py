"""
NOON 数据分析系统 - FastAPI 主入口
启动命令: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models.database import init_db
from app.api.webhook import router as webhook_router
from app.api.products import router as products_router
from app.api.tasks import router as tasks_router
from app.api.reviews import router as reviews_router

# ── 日志配置 ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化数据库"""
    logger.info(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} 正在启动...")
    await init_db()
    logger.info("✅ 数据库表结构初始化完成")
    yield
    logger.info("🛑 系统正在关闭...")


# ── 创建 FastAPI 应用 ──
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "NOON 电商平台数据分析系统 API\n\n"
        "功能模块:\n"
        "- 🔍 商品追踪与管理\n"
        "- 📊 价格监控与预警\n"
        "- 🤖 Oxylabs 爬虫任务调度\n"
        "- 📥 Webhook 数据接收与 ETL\n"
    ),
    lifespan=lifespan,
)

# ── 跨域中间件（开发环境允许所有来源）──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 注册路由 ──
app.include_router(webhook_router)
app.include_router(products_router)
app.include_router(tasks_router)
app.include_router(reviews_router)


# ── 根路径 & 健康检查 ──

@app.get("/", tags=["系统"])
async def root():
    """系统信息"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "endpoints": {
            "商品管理": "/api/v1/products",
            "爬虫任务": "/api/v1/tasks",
            "Webhook": "/api/v1/webhook/oxylabs",
        },
    }


@app.get("/health", tags=["系统"])
async def health_check():
    """健康检查接口"""
    return {"status": "healthy", "service": settings.APP_NAME}
