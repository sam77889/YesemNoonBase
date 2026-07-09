import pytest
from app.models.product import CategoryTranslation

def test_category_translation_model():
    model = CategoryTranslation(english_name="power bank", chinese_label="充电宝")
    assert model.english_name == "power bank"
    assert model.chinese_label == "充电宝"
    assert CategoryTranslation.__tablename__ == "category_translations"
