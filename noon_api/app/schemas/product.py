"""
NOON 数据分析系统 - 商品相关 Pydantic 接口模型
用于 API 请求/响应的数据校验与序列化
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


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


class CategoryCount(BaseModel):
    label: str
    value: str
    count: int


class CategoryAnalyzeRequest(BaseModel):
    """启动类目评论分析的请求体"""
    category: str


class CategoryAnalyzeResponse(BaseModel):
    """启动类目评论分析的响应体"""
    job_id: str
    message: str
    total_products: int


class CategoryAnalysisResponse(BaseModel):
    """类目评论聚合分析响应体"""
    status: str
    message: str
    category: str
    product_count: int
    review_count: int
    reviews: list[dict]
    analysis: dict
    intercepted: bool
    from_cache: Optional[bool] = None
    cached_at: Optional[str] = None


# ─────────────────────────────────────────────
# 性能优化 P0-1 / P0-3 新增响应模型
# ─────────────────────────────────────────────

class ProductListResponse(BaseModel):
    """商品列表（服务端分页）响应体"""
    items: List[ProductResponse]
    total: int





class OverviewSummary(BaseModel):
    total_products: int
    active_products: int
    total_reviews: int


class PriceBucket(BaseModel):
    name: str
    productCount: int
    totalReviews: int


class PriceSalesScatterPoint(BaseModel):
    name: str
    price: Optional[float] = None
    sales: int
    reviews: int
    rating: float


class BrandRankItem(BaseModel):
    """品牌排名项。字段用英文，序列化时通过 alias 输出中文 key（与前端保持一致）。"""
    name: str
    product_count: int = Field(alias='商品数')
    total_reviews: int = Field(alias='总评论')
    avg_rating: float = Field(alias='均分')
    model_config = ConfigDict(populate_by_name=True)


class OverviewAggregation(BaseModel):
    """大盘总览聚合（服务端复刻前端算法）"""
    summary: OverviewSummary
    price_distribution: List[PriceBucket]
    price_sales_scatter: List[PriceSalesScatterPoint]
    brand_ranking: List[BrandRankItem]
