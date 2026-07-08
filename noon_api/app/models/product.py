"""
NOON 数据分析系统 - 商品与价格 ORM 模型
TrackedProduct: 我们追踪监控的 NOON 商品基础信息
PriceSnapshot:  商品的每次价格快照（时序数据，用于趋势分析）
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from app.models.database import Base


class TrackedProduct(Base):
    """
    监控商品表
    存储我们需要持续跟踪的 NOON 平台商品的基础信息
    """
    __tablename__ = "tracked_products"

    sku = Column(String(50), primary_key=True, comment="NOON 商品唯一 SKU")
    title = Column(String(500), nullable=False, comment="商品标题")
    brand = Column(String(100), nullable=True, comment="品牌名称")
    category = Column(String(100), nullable=True, comment="商品分类")
    subcategory = Column(String(100), nullable=True, comment="子分类")
    image_url = Column(Text, nullable=True, comment="商品主图 URL")
    product_url = Column(Text, nullable=True, comment="商品详情页 URL")
    is_express = Column(Boolean, default=False, comment="是否为 NOON Express 履约")
    seller_name = Column(String(100), nullable=True, comment="卖家名称")
    status = Column(String(20), default="ACTIVE", comment="追踪状态: ACTIVE / INACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow, comment="首次录入时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="最后更新时间")

    # ── 关联：一个商品有多个价格快照 ──
    price_snapshots = relationship("PriceSnapshot", back_populates="product", lazy="selectin")
    # ── 关联：一个商品有多条评论 ──
    reviews = relationship("ProductReview", back_populates="product", lazy="selectin")

    def __repr__(self):
        return f"<TrackedProduct sku={self.sku} title={self.title[:30]}>"


class ProductReview(Base):
    """
    商品评论持久化表
    用于类目级评论深度分析的背景任务聚合
    """
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(50), ForeignKey("tracked_products.sku"), nullable=False, index=True, comment="关联商品 SKU")
    rating = Column(Integer, nullable=False, comment="评分 1-5")
    title = Column(Text, nullable=True, comment="评论标题")
    body = Column(Text, nullable=True, comment="评论正文")
    author = Column(String(200), nullable=True, comment="评论作者")
    helpful_count = Column(Integer, default=0, comment="有用票数")
    verified = Column(Boolean, default=False, comment="是否 Verified Purchase")
    review_created_at = Column(DateTime, nullable=True, comment="评论原始创建时间")
    fetched_at = Column(DateTime, default=datetime.utcnow, comment="评论抓取时间")
    raw_data = Column(JSON, nullable=True, comment="原始 JSON-LD 片段")

    product = relationship("TrackedProduct", back_populates="reviews")

    def __repr__(self):
        return f"<ProductReview sku={self.sku} rating={self.rating}>"


class PriceSnapshot(Base):
    """
    商品价格快照表
    每次爬取时记录一条，用于价格趋势分析、价格预警、利润核算
    """
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(50), ForeignKey("tracked_products.sku"), nullable=False, index=True, comment="关联商品 SKU")
    price = Column(Float, nullable=False, comment="当前售价")
    original_price = Column(Float, nullable=True, comment="原价（用于计算折扣率）")
    currency = Column(String(10), default="AED", comment="货币单位: AED / SAR / EGP")
    discount_percent = Column(Float, nullable=True, comment="折扣百分比")
    rating = Column(Float, nullable=True, comment="商品评分 (1-5)")
    review_count = Column(Integer, nullable=True, comment="评论数量")
    seller_name = Column(String(100), nullable=True, comment="当前卖家名称")
    scraped_at = Column(DateTime, default=datetime.utcnow, comment="数据抓取时间")
    raw_data = Column(JSON, nullable=True, comment="原始 JSON 数据（调试用）")

    # ── 关联：属于某个被追踪商品 ──
    product = relationship("TrackedProduct", back_populates="price_snapshots")

    def __repr__(self):
        return f"<PriceSnapshot sku={self.sku} price={self.price} at={self.scraped_at}>"
