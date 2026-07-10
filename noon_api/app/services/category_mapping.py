"""
NOON 类目映射服务
将前端中文类目名与数据库中原始英文 category / title 做双向映射。
逻辑必须与 noon_dashboard/src/App.tsx 中的 normalizeCategory 保持一致。
"""
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models.product import CategoryTranslation
from deep_translator import GoogleTranslator
import asyncio

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
    "充电宝": {
        "raw": ["power bank", "portable charger"],
        "title_keywords": ["power bank", "charger", "mah", "portable charger"],
    },
    "蓝牙耳机": {
        "raw": ["bluetooth earbuds", "wireless earphones", "bluetooth headset"],
        "title_keywords": ["earbuds", "earphones", "bluetooth", "wireless"],
    },
    "手机壳": {
        "raw": ["phone case", "phone cover", "mobile phone case"],
        "title_keywords": ["phone case", "cover", "silicone", "phone holder"],
    },
    "空气炸锅": {
        "raw": ["air fryer", "air fryers"],
        "title_keywords": ["air fryer", "fryer", "deep fryer"],
    },
    "收纳盒": {
        "raw": ["storage box", "organizer", "storage organizer"],
        "title_keywords": ["storage", "box", "organizer", "drawer"],
    },
    "数据线": {
        "raw": ["usb cable", "charging cable", "data cable"],
        "title_keywords": ["cable", "usb", "charging", "data line"],
    },
    "台灯": {
        "raw": ["desk lamp", "table lamp", "reading lamp"],
        "title_keywords": ["desk lamp", "led lamp", "reading", "table lamp"],
    },
    "化妆刷": {
        "raw": ["makeup brush", "makeup brush set", "cosmetic brush"],
        "title_keywords": ["makeup", "brush", "cosmetic", "beauty brush"],
    },
    "LED灯带": {
        "raw": ["led strip lights", "led strip", "led light strip"],
        "title_keywords": ["led", "strip", "light strip", "rgb"],
    },
    "车载手机支架": {
        "raw": ["car phone mount", "car phone holder", "car mount"],
        "title_keywords": ["car", "mount", "holder", "phone holder"],
    },
    "多功能切菜器": {
        "raw": ["vegetable chopper", "food chopper", "kitchen cutter"],
        "title_keywords": ["chopper", "cutter", "slicer", "vegetable"],
    },
    "硅胶厨具": {
        "raw": ["silicone kitchen utensils", "silicone spatula", "silicone cooking"],
        "title_keywords": ["silicone", "kitchen", "utensil", "spatula"],
    },
    "颈枕": {
        "raw": ["neck pillow", "travel pillow", "cervical pillow"],
        "title_keywords": ["neck pillow", "travel pillow", "cervical", "u-shaped"],
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
    if c in ["power bank", "portable charger"]:
        return "充电宝"
    if c in ["bluetooth earbuds", "wireless earphones", "bluetooth headset"]:
        return "蓝牙耳机"
    if c in ["phone case", "phone cover", "mobile phone case"]:
        return "手机壳"
    if c in ["air fryer", "air fryers"]:
        return "空气炸锅"
    if c in ["storage box", "organizer", "storage organizer"]:
        return "收纳盒"
    if c in ["usb cable", "charging cable", "data cable"]:
        return "数据线"
    if c in ["desk lamp", "table lamp", "reading lamp"]:
        return "台灯"
    if c in ["makeup brush", "makeup brush set", "cosmetic brush"]:
        return "化妆刷"
    if c in ["led strip lights", "led strip", "led light strip"]:
        return "LED灯带"
    if c in ["car phone mount", "car phone holder", "car mount"]:
        return "车载手机支架"
    if c in ["vegetable chopper", "food chopper", "kitchen cutter"]:
        return "多功能切菜器"
    if c in ["silicone kitchen utensils", "silicone spatula", "silicone cooking"]:
        return "硅胶厨具"
    if c in ["neck pillow", "travel pillow", "cervical pillow"]:
        return "颈枕"

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
        if "power bank" in t or "portable charger" in t:
            return "充电宝"
        if "earbuds" in t or "earphones" in t or "bluetooth" in t:
            return "蓝牙耳机"
        if "phone case" in t or "phone cover" in t:
            return "手机壳"
        if "air fryer" in t:
            return "空气炸锅"
        if "storage" in t and ("box" in t or "organizer" in t):
            return "收纳盒"
        if "cable" in t and ("usb" in t or "charging" in t):
            return "数据线"
        if "desk lamp" in t or "table lamp" in t or "reading lamp" in t:
            return "台灯"
        if "makeup" in t and "brush" in t:
            return "化妆刷"
        if "led" in t and "strip" in t:
            return "LED灯带"
        if "car" in t and ("mount" in t or "holder" in t):
            return "车载手机支架"
        if "chopper" in t or "slicer" in t:
            return "多功能切菜器"
        if "silicone" in t and ("kitchen" in t or "utensil" in t or "spatula" in t):
            return "硅胶厨具"
        if "neck pillow" in t or "travel pillow" in t:
            return "颈枕"
    return "未分类"


def list_supported_categories() -> List[str]:
    """返回支持类目分析的中文类目名列表。"""
    return list(CATEGORY_MAP.keys())


async def get_chinese_label(category_val: str, db: AsyncSession) -> str:
    c = category_val.lower().strip()
    
    for zh_label, rules in CATEGORY_MAP.items():
        if c in rules.get("raw", []):
            return zh_label
            
    stmt = select(CategoryTranslation).where(CategoryTranslation.english_name == c)
    result = await db.execute(stmt)
    cached = result.scalar_one_or_none()
    
    if cached:
        return cached.chinese_label
        
    translator = GoogleTranslator(source='auto', target='zh-CN')
    try:
        zh_label = await asyncio.to_thread(translator.translate, c)
        if not zh_label:
            zh_label = category_val
    except Exception:
        zh_label = category_val
        
    new_trans = CategoryTranslation(english_name=c, chinese_label=zh_label)
    db.add(new_trans)
    
    return zh_label
