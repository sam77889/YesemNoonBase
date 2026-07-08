"""
NOON 数据分析系统 - 关键词映射服务
将中文搜索词转换为 NOON 平台的英文搜索词

功能：
1. 从 keyword_map.json 加载映射表
2. 查询映射：中文 → 英文
3. 未命中时调用 Google Translate 翻译
4. 支持添加新映射并持久化
"""
import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# 映射表文件路径
MAP_FILE = Path(__file__).parent.parent.parent / "keyword_map.json"


class KeywordService:
    """关键词映射服务"""

    def __init__(self):
        self.keyword_map: dict[str, str] = {}
        self._load_map()

    def _load_map(self):
        """从 JSON 文件加载映射表"""
        try:
            if MAP_FILE.exists():
                self.keyword_map = json.loads(MAP_FILE.read_text(encoding="utf-8"))
                logger.info(f"[KeywordService] 加载了 {len(self.keyword_map)} 条映射")
            else:
                logger.warning(f"[KeywordService] 映射文件不存在: {MAP_FILE}")
                self.keyword_map = {}
        except Exception as e:
            logger.error(f"[KeywordService] 加载映射失败: {e}")
            self.keyword_map = {}

    def translate(self, query: str) -> str:
        """
        翻译搜索词：中文 → 英文
        优先查映射表，未命中则调用 Google Translate
        """
        query = query.strip()
        if not query:
            return query

        # 1. 查映射表
        if query in self.keyword_map:
            result = self.keyword_map[query]
            logger.info(f"[KeywordService] 映射命中: {query} → {result}")
            return result

        # 2. 判断是否需要翻译（包含中文字符则需要）
        if self._contains_chinese(query):
            result = self._google_translate(query)
            if result:
                logger.info(f"[KeywordService] Google翻译: {query} → {result}")
                return result

        # 3. 非中文或翻译失败，返回原文
        return query

    def _contains_chinese(self, text: str) -> bool:
        """检查文本是否包含中文字符"""
        for char in text:
            if '\u4e00' <= char <= '\u9fff':
                return True
        return False

    def _google_translate(self, text: str) -> Optional[str]:
        """调用 Google Translate 翻译"""
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source='zh-CN', target='en')
            result = translator.translate(text)
            return result if result else None
        except Exception as e:
            logger.error(f"[KeywordService] Google翻译失败: {e}")
            return None

    def add_keyword(self, chinese: str, english: str):
        """添加新映射并持久化"""
        chinese = chinese.strip()
        english = english.strip()
        if chinese and english:
            self.keyword_map[chinese] = english
            self._save_map()
            logger.info(f"[KeywordService] 添加映射: {chinese} → {english}")

    def remove_keyword(self, chinese: str):
        """删除映射"""
        chinese = chinese.strip()
        if chinese in self.keyword_map:
            del self.keyword_map[chinese]
            self._save_map()
            logger.info(f"[KeywordService] 删除映射: {chinese}")

    def _save_map(self):
        """保存映射表到 JSON 文件"""
        try:
            MAP_FILE.write_text(
                json.dumps(self.keyword_map, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
        except Exception as e:
            logger.error(f"[KeywordService] 保存映射失败: {e}")

    def list_all(self) -> dict[str, str]:
        """返回所有映射"""
        return self.keyword_map.copy()


# 全局单例
_keyword_service: Optional[KeywordService] = None


def get_keyword_service() -> KeywordService:
    """获取关键词服务单例"""
    global _keyword_service
    if _keyword_service is None:
        _keyword_service = KeywordService()
    return _keyword_service
