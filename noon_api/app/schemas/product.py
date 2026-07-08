"""
NOON 数据分析系统 - 商品相关 Pydantic 接口模型
用于 API 请求/响应的数据校验与序列化
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    """商品基础字段"""
    sku: str
    title: str
    brand: Optional[str] = None
    category: Optional[str] = None


class ProductCreate(ProductBase):
    """创建/追踪商品时的请求体"""
    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    product_url: Optional[str] = None
    is_express: bool = False
    seller_name: Optional[str] = None


class ProductResponse(ProductBase):
    """商品信息响应体"""
    model_config = ConfigDict(from_attributes=True)

    subcategory: Optional[str] = None
    image_url: Optional[str] = None
    product_url: Optional[str] = None
    is_express: bool = False
    seller_name: Optional[str] = None
    status: str = "ACTIVE"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None


class PriceSnapshotResponse(BaseModel):
    """价格快照响应体"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    price: float
    original_price: Optional[float] = None
    currency: str = "AED"
    discount_percent: Optional[float] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    seller_name: Optional[str] = None
    scraped_at: Optional[datetime] = None


class ProductWithPrices(ProductResponse):
    """商品信息 + 价格历史（用于详情页展示）"""
    price_snapshots: list[PriceSnapshotResponse] = []
