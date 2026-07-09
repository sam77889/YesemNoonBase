import pytest
from app.schemas.product import CategoryCount
from app.services.category_mapping import get_chinese_label

def test_category_count_schema():
    c = CategoryCount(label="按摩器", value="massage gun", count=10)
    assert c.label == "按摩器"
    assert c.value == "massage gun"
