"""
数据库迁移脚本：添加 sold_recently 字段到 price_snapshots 表
"""
import asyncio
from sqlalchemy import text
from app.models.database import engine

async def migrate():
    async with engine.begin() as conn:
        # 检查字段是否已存在
        result = await conn.execute(text(
            "PRAGMA table_info(price_snapshots)"
        ))
        columns = [row[1] for row in result.fetchall()]
        
        if 'sold_recently' not in columns:
            print("Adding sold_recently column to price_snapshots table...")
            await conn.execute(text(
                "ALTER TABLE price_snapshots ADD COLUMN sold_recently INTEGER"
            ))
            print("Migration completed successfully!")
        else:
            print("sold_recently column already exists, skipping migration.")

if __name__ == "__main__":
    asyncio.run(migrate())