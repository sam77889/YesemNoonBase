"""
NOON 数据分析系统 - 全局配置
通过 .env 文件加载环境变量，统一管理数据库、API 密钥等配置项
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """系统全局配置"""

    # ── 应用信息 ──
    APP_NAME: str = "NOON 数据分析系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── PostgreSQL (元数据/配置存储) ──
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/noon_data"

    # ── ClickHouse (分析型时序数据) ──
    CLICKHOUSE_HOST: str = "localhost"
    CLICKHOUSE_PORT: int = 8123
    CLICKHOUSE_DB: str = "noon_analytics"

    # ── Redis (缓存 / 任务队列) ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── 数据源切换 (scraperapi / oxylabs) ──
    SCRAPER_PROVIDER: str = "scraperapi"

    # ── ScraperAPI (免费试用: 7天5000次, 长期1000次/月) ──
    SCRAPERAPI_KEY: str = ""
    SCRAPERAPI_URL: str = "https://api.scraperapi.com"

    # ── Oxylabs Web Scraper API (企业级) ──
    OXYLABS_USERNAME: str = ""
    OXYLABS_PASSWORD: str = ""
    OXYLABS_API_URL: str = "https://realtime.oxylabs.io/v1/queries"

    # ── Webhook 安全 ──
    WEBHOOK_SECRET: str = "noon-webhook-secret-change-me"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


@lru_cache()
def get_settings() -> Settings:
    """获取全局配置单例（缓存）"""
    return Settings()
