"""
NOON 数据分析系统 - Streamlit 可视化仪表盘
启动命令: streamlit run dashboard.py --server.port 8501
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import httpx
import asyncio

# ── 页面配置 ──
st.set_page_config(
    page_title="NOON 数据分析系统",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── API 配置 ──
API_BASE = "http://localhost:8000/api/v1"

# ── 自定义样式 ──
st.markdown("""
<style>
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
        text-align: center;
    }
    .metric-card h3 {
        margin: 0;
        font-size: 2rem;
    }
    .metric-card p {
        margin: 5px 0 0 0;
        opacity: 0.8;
    }
    .alert-critical {
        background-color: #ff4444;
        color: white;
        padding: 10px;
        border-radius: 5px;
        margin: 5px 0;
    }
    .alert-warning {
        background-color: #ffbb33;
        color: black;
        padding: 10px;
        border-radius: 5px;
        margin: 5px 0;
    }
</style>
""", unsafe_allow_html=True)


# ── 工具函数 ──
@st.cache_data(ttl=60)
def fetch_products():
    """获取商品列表"""
    try:
        resp = httpx.get(f"{API_BASE}/products/", timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        st.error(f"API 连接失败: {e}")
    return []


@st.cache_data(ttl=60)
def fetch_product_stats():
    """获取商品统计"""
    try:
        resp = httpx.get(f"{API_BASE}/products/stats", timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return {"total_products": 0, "active_products": 0, "total_snapshots": 0}


@st.cache_data(ttl=60)
def fetch_price_history(sku, days=30):
    """获取价格历史"""
    try:
        resp = httpx.get(f"{API_BASE}/products/{sku}/prices", params={"days": days}, timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return []


@st.cache_data(ttl=60)
def fetch_tasks():
    """获取爬虫任务列表"""
    try:
        resp = httpx.get(f"{API_BASE}/tasks/", timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return []


# ── 侧边栏导航 ──
st.sidebar.title("📊 NOON 数据分析")
st.sidebar.markdown("---")

page = st.sidebar.radio(
    "导航",
    ["🏠 概览", "📦 商品管理", "📈 价格趋势", "⚠️ 价格预警", "🔄 爬虫任务"]
)

st.sidebar.markdown("---")
st.sidebar.info("NOON 电商平台数据分析系统 v1.0")


# ══════════════════════════════════════════════════════════════
# 🏠 概览页面
# ══════════════════════════════════════════════════════════════
if page == "🏠 概览":
    st.title("🏠 系统概览")
    st.markdown("---")

    # 获取统计数据
    stats = fetch_product_stats()

    # KPI 指标卡片
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            label="📦 追踪商品总数",
            value=stats.get("total_products", 0),
            delta=None
        )

    with col2:
        st.metric(
            label="✅ 活跃商品数",
            value=stats.get("active_products", 0),
            delta=None
        )

    with col3:
        st.metric(
            label="📸 价格快照数",
            value=stats.get("total_snapshots", 0),
            delta=None
        )

    with col4:
        st.metric(
            label="🔄 系统状态",
            value="运行中",
            delta="正常"
        )

    st.markdown("---")

    # 系统架构图
    st.subheader("🏗️ 系统架构")
    st.markdown("""
    ```
    ┌─────────────────────────────────────────────────────────────────┐
    │                        仪表盘 (Streamlit)                       │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
    │  │ 商品管理  │  │ 价格趋势  │  │ 价格预警  │  │ 任务监控  │        │
    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
    ├─────────────────────────────────────────────────────────────────┤
    │                      API 网关 (FastAPI)                          │
    ├─────────────────────────────────────────────────────────────────┤
    │                      服务层                                      │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
    │  │ 爬虫调度  │  │ ETL 清洗  │  │ 价格监控  │  │ 数据存储  │        │
    │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
    ├─────────────────────────────────────────────────────────────────┤
    │                      数据采集                                    │
    │  ┌──────────┐  ┌──────────┐                                   │
    │  │ScraperAPI│  │ Oxylabs  │                                   │
    │  └──────────┘  └──────────┘                                   │
    └─────────────────────────────────────────────────────────────────┘
    ```
    """)

    # 最近商品
    st.subheader("📋 最近追踪的商品")
    products = fetch_products()
    if products:
        df = pd.DataFrame(products[:10])
        if "sku" in df.columns:
            st.dataframe(
                df[["sku", "title", "price", "brand", "category", "status"]].head(10),
                use_container_width=True
            )
    else:
        st.info("暂无商品数据，请先创建爬虫任务采集数据")


# ══════════════════════════════════════════════════════════════
# 📦 商品管理页面
# ══════════════════════════════════════════════════════════════
elif page == "📦 商品管理":
    st.title("📦 商品管理")
    st.markdown("---")

    # 筛选器
    col1, col2, col3 = st.columns([2, 2, 1])

    with col1:
        search_query = st.text_input("🔍 搜索商品", placeholder="输入 SKU 或商品名称...")

    with col2:
        status_filter = st.selectbox("📊 状态筛选", ["ALL", "ACTIVE", "INACTIVE"])

    with col3:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("🔄 刷新数据", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

    st.markdown("---")

    # 获取商品列表
    products = fetch_products()

    if products:
        df = pd.DataFrame(products)

        # 筛选逻辑
        if status_filter != "ALL" and "status" in df.columns:
            df = df[df["status"] == status_filter]

        if search_query:
            mask = df.apply(lambda row: search_query.lower() in str(row.values).lower(), axis=1)
            df = df[mask]

        # 显示统计
        st.metric("📊 筛选结果", f"{len(df)} 个商品")

        # 商品表格
        if not df.empty:
            # 选择显示的列
            display_cols = [col for col in ["sku", "title", "price", "brand", "category", "seller_name", "is_express", "status"]
                          if col in df.columns]

            st.dataframe(
                df[display_cols],
                use_container_width=True,
                column_config={
                    "sku": st.column_config.TextColumn("SKU", width="medium"),
                    "title": st.column_config.TextColumn("商品名称", width="large"),
                    "price": st.column_config.NumberColumn("价格 (AED)", format="%.2f"),
                    "brand": st.column_config.TextColumn("品牌", width="medium"),
                    "category": st.column_config.TextColumn("分类", width="medium"),
                    "seller_name": st.column_config.TextColumn("卖家", width="medium"),
                    "is_express": st.column_config.CheckboxColumn("NOON Express"),
                    "status": st.column_config.TextColumn("状态", width="small"),
                }
            )

            # 商品详情展开
            st.markdown("---")
            st.subheader("📝 商品详情")
            selected_sku = st.selectbox("选择商品查看详细信息", df["sku"].tolist())

            if selected_sku:
                product = df[df["sku"] == selected_sku].iloc[0]

                col1, col2 = st.columns(2)
                with col1:
                    st.write("**SKU:**", product.get("sku", "N/A"))
                    st.write("**品牌:**", product.get("brand", "N/A"))
                    st.write("**分类:**", product.get("category", "N/A"))
                    st.write("**卖家:**", product.get("seller_name", "N/A"))

                with col2:
                    st.write("**价格:**", f"AED {product.get('price', 'N/A')}")
                    st.write("**NOON Express:**", "是" if product.get("is_express") else "否")
                    st.write("**状态:**", product.get("status", "N/A"))
                    if product.get("product_url"):
                        st.markdown(f"[🔗 查看商品页面]({product['product_url']})")
        else:
            st.warning("没有找到匹配的商品")
    else:
        st.info("📦 暂无商品数据")
        st.markdown("""
        ### 如何添加数据？

        1. 启动后端 API 服务:
        ```bash
        cd /home/san/AiAgentsWorkSpace/noon_api
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
        ```

        2. 创建爬虫任务:
        ```bash
        curl -X POST http://localhost:8000/api/v1/tasks/search \
          -H "Content-Type: application/json" \
          -d '{"query": "iphone", "country": "uae", "language": "en", "pages": 1}'
        ```
        """)


# ══════════════════════════════════════════════════════════════
# 📈 价格趋势页面
# ══════════════════════════════════════════════════════════════
elif page == "📈 价格趋势":
    st.title("📈 价格趋势分析")
    st.markdown("---")

    products = fetch_products()

    if products:
        # 商品选择
        col1, col2 = st.columns([3, 1])

        with col1:
            product_options = {p.get("sku", ""): f"{p.get('sku', '')} - {p.get('title', '')[:50]}"
                             for p in products if p.get("sku")}
            selected_sku = st.selectbox(
                "选择商品",
                options=list(product_options.keys()),
                format_func=lambda x: product_options[x]
            )

        with col2:
            days = st.selectbox("时间范围", [7, 14, 30, 60, 90], index=2)

        st.markdown("---")

        if selected_sku:
            # 获取价格历史
            price_history = fetch_price_history(selected_sku, days)

            if price_history:
                df_prices = pd.DataFrame(price_history)

                # 价格趋势图
                st.subheader(f"📊 {selected_sku} 价格走势")

                if "scraped_at" in df_prices.columns and "price" in df_prices.columns:
                    fig = px.line(
                        df_prices,
                        x="scraped_at",
                        y="price",
                        title=f"最近 {days} 天价格变化",
                        labels={"scraped_at": "时间", "price": "价格 (AED)"},
                        markers=True
                    )
                    fig.update_layout(
                        xaxis_title="时间",
                        yaxis_title="价格 (AED)",
                        hovermode="x unified"
                    )
                    st.plotly_chart(fig, use_container_width=True)

                    # 价格统计
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.metric("当前价格", f"AED {df_prices['price'].iloc[-1]:.2f}")
                    with col2:
                        st.metric("最低价格", f"AED {df_prices['price'].min():.2f}")
                    with col3:
                        st.metric("最高价格", f"AED {df_prices['price'].max():.2f}")
                    with col4:
                        avg_price = df_prices['price'].mean()
                        st.metric("平均价格", f"AED {avg_price:.2f}")

                    # 价格波动分析
                    st.subheader("📉 价格波动分析")
                    price_range = df_prices['price'].max() - df_prices['price'].min()
                    price_std = df_prices['price'].std()

                    col1, col2 = st.columns(2)
                    with col1:
                        st.write("**价格波动范围:**", f"AED {price_range:.2f}")
                        st.write("**标准差:**", f"AED {price_std:.2f}")
                    with col2:
                        volatility = (price_std / avg_price * 100) if avg_price > 0 else 0
                        st.write("**波动率:**", f"{volatility:.2f}%")
                        if volatility > 10:
                            st.warning("⚠️ 价格波动较大，建议关注")
                        else:
                            st.success("✅ 价格相对稳定")

                    # 原始数据
                    with st.expander("📋 查看原始数据"):
                        st.dataframe(df_prices, use_container_width=True)
                else:
                    st.warning("价格数据格式异常")
            else:
                st.info(f"📭 商品 {selected_sku} 暂无价格历史数据")
    else:
        st.info("📭 暂无商品数据")


# ══════════════════════════════════════════════════════════════
# ⚠️ 价格预警页面
# ══════════════════════════════════════════════════════════════
elif page == "⚠️ 价格预警":
    st.title("⚠️ 价格预警监控")
    st.markdown("---")

    products = fetch_products()

    if products:
        # 找出有价格数据的商品
        products_with_price = [p for p in products if p.get("price") and p.get("sku")]

        if products_with_price:
            # 模拟预警数据（实际应该从 API 获取）
            st.subheader("🔔 最近价格变动")

            # 统计各状态商品
            active_count = sum(1 for p in products if p.get("status") == "ACTIVE")
            inactive_count = sum(1 for p in products if p.get("status") == "INACTIVE")

            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("活跃商品", active_count)
            with col2:
                st.metric("停用商品", inactive_count)
            with col3:
                st.metric("有价格数据", len(products_with_price))

            st.markdown("---")

            # 价格分布
            st.subheader("📊 价格分布")
            prices = [p["price"] for p in products_with_price]

            fig = px.histogram(
                x=prices,
                nbins=20,
                title="商品价格分布",
                labels={"x": "价格 (AED)", "y": "商品数量"}
            )
            fig.update_layout(bargap=0.1)
            st.plotly_chart(fig, use_container_width=True)

            # 价格区间统计
            st.subheader("💰 价格区间统计")
            price_ranges = {
                "0-50 AED": sum(1 for p in prices if p <= 50),
                "50-100 AED": sum(1 for p in prices if 50 < p <= 100),
                "100-500 AED": sum(1 for p in prices if 100 < p <= 500),
                "500-1000 AED": sum(1 for p in prices if 500 < p <= 1000),
                "1000+ AED": sum(1 for p in prices if p > 1000),
            }

            df_ranges = pd.DataFrame(list(price_ranges.items()), columns=["价格区间", "商品数量"])
            st.bar_chart(df_ranges.set_index("价格区间"))

        else:
            st.info("📭 暂无价格数据，无法生成预警")
    else:
        st.info("📭 暂无商品数据")


# ══════════════════════════════════════════════════════════════
# 🔄 爬虫任务页面
# ══════════════════════════════════════════════════════════════
elif page == "🔄 爬虫任务":
    st.title("🔄 爬虫任务管理")
    st.markdown("---")

    # 创建新任务
    st.subheader("➕ 创建新任务")

    with st.form("create_task"):
        col1, col2 = st.columns(2)

        with col1:
            query = st.text_input("🔍 搜索关键词", placeholder="例如: iphone, samsung, laptop")
            country = st.selectbox("🌍 目标国家", ["uae", "saudi", "egypt"])

        with col2:
            language = st.selectbox("🗣️ 语言", ["en", "ar"])
            pages = st.number_input("📄 抓取页数", min_value=1, max_value=10, value=1)

        submitted = st.form_submit_button("🚀 创建任务", use_container_width=True)

        if submitted and query:
            try:
                resp = httpx.post(
                    f"{API_BASE}/tasks/search",
                    json={
                        "query": query,
                        "country": country,
                        "language": language,
                        "pages": pages
                    },
                    timeout=10
                )
                if resp.status_code == 200:
                    st.success(f"✅ 任务已创建: {resp.json().get('message', '成功')}")
                    st.cache_data.clear()
                else:
                    st.error(f"❌ 创建失败: {resp.text}")
            except Exception as e:
                st.error(f"❌ API 连接失败: {e}")

    st.markdown("---")

    # 任务列表
    st.subheader("📋 任务列表")

    if st.button("🔄 刷新任务列表"):
        st.cache_data.clear()
        st.rerun()

    tasks = fetch_tasks()

    if tasks:
        df_tasks = pd.DataFrame(tasks)

        # 任务状态统计
        if "status" in df_tasks.columns:
            status_counts = df_tasks["status"].value_counts()

            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("待处理", status_counts.get("PENDING", 0))
            with col2:
                st.metric("处理中", status_counts.get("PROCESSING", 0))
            with col3:
                st.metric("成功", status_counts.get("SUCCESS", 0))
            with col4:
                st.metric("失败", status_counts.get("FAILED", 0))

        st.markdown("---")

        # 任务表格
        display_cols = [col for col in ["job_id", "task_type", "query", "country", "status", "result_count", "created_at"]
                       if col in df_tasks.columns]

        st.dataframe(
            df_tasks[display_cols],
            use_container_width=True,
            column_config={
                "job_id": st.column_config.TextColumn("任务 ID", width="medium"),
                "task_type": st.column_config.TextColumn("类型", width="small"),
                "query": st.column_config.TextColumn("搜索词", width="large"),
                "country": st.column_config.TextColumn("国家", width="small"),
                "status": st.column_config.TextColumn("状态", width="small"),
                "result_count": st.column_config.NumberColumn("结果数"),
                "created_at": st.column_config.TextColumn("创建时间", width="medium"),
            }
        )
    else:
        st.info("📭 暂无任务记录")


# ── 页脚 ──
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #888;'>
        NOON 数据分析系统 v1.0 | Powered by FastAPI + Streamlit
    </div>
    """,
    unsafe_allow_html=True
)
