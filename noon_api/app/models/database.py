"""
NOON 数据分析系统 - 数据库连接与会话管理
使用异步 SQLAlchemy 连接 PostgreSQL
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

# ── 异步数据库引擎（SQLite 不支持连接池参数）──
_engine_kwargs = {"echo": settings.DEBUG}
if "sqlite" not in settings.DATABASE_URL:
    _engine_kwargs.update({"pool_size": 20, "max_overflow": 10})

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

# ── 异步会话工厂 ──
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """ORM 模型基类"""
    pass


async def get_db():
    """
    FastAPI 依赖注入：获取数据库会话
    使用方式: db: AsyncSession = Depends(get_db)
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """初始化数据库：创建所有表结构"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
