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
