# noon_api/create_translation_table.py
import asyncio
from app.models.database import engine
from app.models.product import CategoryTranslation

async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(CategoryTranslation.__table__.create, checkfirst=True)

if __name__ == "__main__":
    asyncio.run(init_models())
