import asyncio
import logging
import sqlite3
from sqlalchemy import text
from app.models.database import async_session_maker
from app.models.product import TrackedProduct

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate_and_backfill():
    # 1. 增加列 (SQLite 无法一次增加多个，需要多次执行 ALTER TABLE)
    # 我们用 sqlite3 原生连接或者 text()
    # 先用 sqlalchemy 连接执行 alter table
    
    db_path = "noon_data.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns_to_add = {
        "price": "REAL",
        "original_price": "REAL",
        "discount_percent": "REAL",
        "rating": "REAL",
        "review_count": "INTEGER",
        "sold_recently": "INTEGER",
    }
    
    for col, dtype in columns_to_add.items():
        try:
            cursor.execute(f"ALTER TABLE tracked_products ADD COLUMN {col} {dtype}")
            logger.info(f"Added column: {col}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                logger.info(f"Column {col} already exists, skipping.")
            else:
                logger.error(f"Error adding column {col}: {e}")
                
    conn.commit()
    conn.close()

    # 2. 从 price_snapshots 回填最新数据
    logger.info("Starting data backfill...")
    async with async_session_maker() as db:
        # 使用 SQLAlchemy 原生 SQL (UPDATE FROM 语法在较新的 SQLite 中支持)
        # 为安全起见，我们在 Python 内存里批量更新
        from sqlalchemy import select
        from app.models.product import TrackedProduct, PriceSnapshot
        from sqlalchemy.orm import selectinload
        
        stmt = select(TrackedProduct).options(selectinload(TrackedProduct.price_snapshots))
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        updated_count = 0
        for p in products:
            if p.price_snapshots:
                # 获取最新的快照
                latest = max(p.price_snapshots, key=lambda s: s.scraped_at)
                p.price = latest.price
                p.original_price = latest.original_price
                p.discount_percent = latest.discount_percent
                p.rating = latest.rating
                p.review_count = latest.review_count
                p.sold_recently = latest.sold_recently
                updated_count += 1
                
        await db.commit()
        logger.info(f"Successfully backfilled data for {updated_count} products.")

if __name__ == "__main__":
    asyncio.run(migrate_and_backfill())
