import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.database import get_db
from app.schemas.product import CategoryCount
from app.services.category_mapping import get_chinese_label

def test_category_count_schema():
    c = CategoryCount(label="按摩器", value="massage gun", count=10)
    assert c.label == "按摩器"
    assert c.value == "massage gun"

def test_get_category_stats():
    # Setup mock DB session
    mock_session = AsyncMock(spec=AsyncSession)
    
    # Mock db.execute().all() to return two rows
    from unittest.mock import Mock
    mock_result = Mock()
    # Let's say there's 10 massage guns and 5 uncategorized
    mock_result.all.return_value = [("massage gun", 10), ("", 5)]
    mock_session.execute.return_value = mock_result
    
    # Override FastAPI dependency
    app.dependency_overrides[get_db] = lambda: mock_session
    
    client = TestClient(app)
    
    # Mock the bulk translation to avoid real translate/DB interaction
    with patch("app.api.products.get_chinese_labels_bulk", new_callable=AsyncMock) as mock_bulk:
        mock_bulk.return_value = {"massage gun": "按摩器"}
        
        response = client.get("/api/v1/products/stats/categories")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        assert data[0]["label"] == "按摩器"
        assert data[0]["count"] == 10
        assert data[0]["value"] == "massage gun"
        
        assert data[1]["label"] == "未分类"
        assert data[1]["count"] == 5
        assert data[1]["value"] == "__UNCATEGORIZED__"
        
    # Clean up overrides
    app.dependency_overrides.clear()

def test_get_chinese_labels_bulk_logic():
    import asyncio
    async def _run_test():
        from app.services.category_mapping import get_chinese_labels_bulk
        from app.models.product import CategoryTranslation
        from unittest.mock import MagicMock
        
        mock_db = AsyncMock(spec=AsyncSession)
        mock_result = MagicMock()
        
        cached_obj = MagicMock(spec=CategoryTranslation)
        cached_obj.english_name = "cached_item"
        cached_obj.chinese_label = "已缓存项"
        mock_result.scalars.return_value.all.return_value = [cached_obj]
        mock_db.execute.return_value = mock_result
        
        with patch("app.services.category_mapping.GoogleTranslator") as MockTranslator:
            instance = MockTranslator.return_value
            instance.translate.return_value = "新翻译项"
            
            res = await get_chinese_labels_bulk(["yoga mat", "cached_item", "new_item"], mock_db)
            
            assert res["yoga mat"] == "瑜伽垫"
            assert res["cached_item"] == "已缓存项"
            assert res["new_item"] == "新翻译项"
            
            assert mock_db.execute.call_count == 2
            mock_db.commit.assert_called_once()
            
    asyncio.run(_run_test())
