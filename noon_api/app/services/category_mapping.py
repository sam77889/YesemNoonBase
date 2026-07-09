"""
NOON 类目映射服务
将前端中文类目名与数据库中原始英文 category / title 做双向映射。
逻辑必须与 noon_dashboard/src/App.tsx 中的 normalizeCategory 保持一致。
"""
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.product import CategoryTranslation
from deep_translator import GoogleTranslator

CATEGORY_MAP: Dict[str, Dict[str, List[str]]] = {
    "按摩器": {
        "raw": [
            "massage gun",
            "massage guns",
            "massage muscle stimulators",
            "massager",
            "neck massager",
            "eye massager",
        ],
        "title_keywords": ["massage gun", "percussion", "massager", "massage"],
    },
    "手持风扇": {
        "raw": ["handheld fan"],
        "title_keywords": ["fan"],
    },
    "冰格": {
        "raw": [
            "ice tray",
            "ice mold",
            "ice cube trays",
            "ice cube tray",
        ],
        "title_keywords": ["ice", "tray", "mold", "cube"],
    },
    "煮蛋器": {
        "raw": ["egg boiler", "egg cooker", "egg steamer"],
        "title_keywords": ["egg", "boil", "cook"],
    },
    "瑜伽垫": {
        "raw": ["yoga mat", "yoga mats"],
        "title_keywords": ["yoga", "mat"],
    },
}


def denormalize_category(label: str) -> Dict[str, List[str]] | None:
    """把前端中文类目名还原为可查询的原始 category 列表和 title 关键词列表。"""
    return CATEGORY_MAP.get(label)


def normalize_category(category: str | None, title: str | None) -> str:
    """
    与前端 normalizeCategory 保持一致，将原始 category/title 映射为中文类目。
    未匹配时返回 '未分类'。
    """
    c = (category or "").lower().strip()
    if c in [
        "massage gun",
        "massage guns",
        "massage muscle stimulators",
        "massager",
        "neck massager",
        "eye massager",
    ]:
        return "按摩器"
    if c == "handheld fan":
        return "手持风扇"
    if c in ["ice tray", "ice mold", "ice cube trays", "ice cube tray"]:
        return "冰格"
    if c in ["egg boiler", "egg cooker", "egg steamer"]:
        return "煮蛋器"
    if c in ["yoga mat", "yoga mats"]:
        return "瑜伽垫"

    t = (title or "").lower()
    if c == "home appliances" or not c:
        if "massage gun" in t or "percussion" in t:
            return "按摩器"
        if "massager" in t or "massage" in t:
            return "按摩器"
        if "fan" in t:
            return "手持风扇"
        if "ice" in t and ("tray" in t or "mold" in t or "cube" in t):
            return "冰格"
        if "egg" in t and ("boil" in t or "cook" in t):
            return "煮蛋器"
        if "yoga" in t and "mat" in t:
            return "瑜伽垫"
    return "未分类"


def list_supported_categories() -> List[str]:
    """返回支持类目分析的中文类目名列表。"""
    return list(CATEGORY_MAP.keys())


async def get_chinese_label(category_val: str, db: AsyncSession) -> str:
    # Check manual mapping first
    c = category_val.lower().strip()
    for zh_label, rules in CATEGORY_MAP.items():
        if c in rules.get("raw", []):
            return zh_label
    
    # Check DB cache
    stmt = select(CategoryTranslation).where(CategoryTranslation.english_name == c)
    result = await db.execute(stmt)
    cached = result.scalar_one_or_none()
    if cached:
        return cached.chinese_label

    # Auto-translate
    try:
        translator = GoogleTranslator(source='auto', target='zh-CN')
        zh_label = translator.translate(c)
        if not zh_label:
            zh_label = category_val
    except Exception:
        zh_label = category_val

    # Save to cache
    new_trans = CategoryTranslation(english_name=c, chinese_label=zh_label)
    db.add(new_trans)
    await db.commit()
    
    return zh_label
