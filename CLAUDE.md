# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# NOON Base - 跨境电商洞察与智能爬虫系统

针对中东电商 NOON 平台的数据抓取、清洗与可视化大盘。采用前后端分离 + 认证代理的 Monorepo 结构。

## 仓库结构（四大子项目）

```text
noon_base/
├── noon_api/          # Python FastAPI 后端 + Streamlit 备用仪表盘（核心业务逻辑）
├── noon_dashboard/    # React 19 + Vite + TypeScript 主仪表盘（推荐 UI）
├── noon_proxy/        # Express 5 认证代理（生产环境 Cloudflare Tunnel 入口）
├── noon_scraper/      # 独立的 curl_cffi 爬虫模块（无需付费 API，直接绕过 Akamai）
└── test_*.py          # 根目录下的评论/商品页抓取调试脚本
```

> 存在两套 UI：`noon_dashboard/`（React，主要）与 `noon_api/dashboard.py`（Streamlit，备用，端口 8501）。

## 常用开发命令

### 后端 API（`noon_api/`）

首次初始化：

```bash
cd noon_api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install firefox    # 评论抓取依赖 Playwright Firefox 二进制
```

复制环境变量模板并填入真实密钥：

```bash
cp .env.example .env
# 编辑 .env：配置 SCRAPERAPI_KEY 或 OXYLABS_USERNAME/OXYLABS_PASSWORD
```

启动后端：

```bash
cd noon_api && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动 Streamlit 备用仪表盘：

```bash
cd noon_api && source venv/bin/activate
streamlit run dashboard.py --server.port 8501 --server.headless true
```

一键启动 API + Streamlit：

```bash
cd noon_api && ./start_all.sh
```

端到端全链路调试（需先启动 API 并配置 `SCRAPERAPI_KEY`）：

```bash
cd noon_api && source venv/bin/activate && python e2e_test.py
```

数据库回填品牌/类目脚本：

```bash
cd noon_api && source venv/bin/activate && python backfill_brand_category.py
```

评论抓取调试（根目录脚本，可直接调用后端服务或 curl_cffi 测试）：

```bash
cd noon_api && source venv/bin/activate
python -m app.services.fetcher_reviews   # 作为模块运行会调用示例 SKU
# 或
python ../test_pw.py
```

### 前端主仪表盘（`noon_dashboard/`）

```bash
cd noon_dashboard
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
npm run build      # 生产构建：tsc -b && vite build（输出 dist/，供代理托管）
npm run lint       # Oxlint 检查
npm run preview    # 预览生产构建
```

### 认证代理（`noon_proxy/`，生产部署）

```bash
cd noon_proxy
npm install
npm start          # 默认端口 3000，提供 /api 反向代理到后端与静态文件托管
```

## 架构总览

### 1. 后端架构

- **框架**：FastAPI + 异步 SQLAlchemy (`asyncio`/`AsyncSession`)。
- **数据库**：默认使用 SQLite (`sqlite+aiosqlite`)，生产可切换为 PostgreSQL；通过 `DATABASE_URL` 配置。
- **ORM 模型**：
  - `TrackedProduct`：以 `sku` 为主键，维护商品基础信息，软删除字段 `status`（`ACTIVE`/`INACTIVE`）。
  - `PriceSnapshot`：时序快照，记录每次抓取的价格、评论数、评分等。
- **服务入口**：`app/main.py` 注册三个路由模块：`products`、`tasks`、`webhook`。

### 2. 爬虫与数据流

- **统一调度器**：`app/services/scraper_dispatcher.py` 的 `run_search_scrape()` 是抓取主入口。
- **多提供商策略**：通过环境变量 `SCRAPER_PROVIDER` 切换，也支持任务级 `provider` 参数：
  - `scraperapi`：使用 `app/services/scraperapi.py`（默认）。
  - `oxylabs`：使用 `app/services/oxylabs.py`。
  - `fetcher`：使用 `app/services/fetcher_scraper.py`，底层调用 `noon_scraper/` 的 `AsyncNoonScraper`（`curl_cffi` Firefox 指纹），无需付费 API。
- **ScraperAPI 解析逻辑**：NOON 已迁移到 TanStack Router，页面关键数据在 `__TSR__` 内联 JS 对象中。`parse_noon_search_html()` 优先用正则从 `catalog_sku:` 等字段提取商品信息，失败才回退到 `__NEXT_DATA__` 和传统 DOM 解析。
- **评论抓取**：`app/services/fetcher_reviews.py` 使用 Playwright 无头 Firefox 访问商品页，在浏览器上下文中调用内部 API `/_svc/reviews-api/v1/product/{sku}/reviews`。该路径会识别 Akamai 508 / `sec-if-cpt-container` 拦截并返回明确状态。
- **并发控制**：ScraperAPI 模式下多页抓取使用 `asyncio.Semaphore(3)` 限制最大并发。
- **数据清洗**：
  - 关键词命中过滤（标题必须包含查询词，或 SKU 精确匹配）。
  - 全局中位数离群点过滤（价格低于中位数 0.2 倍或高于 4 倍被剔除）。
- **入库**：`app/services/etl.py` 的 `save_products_to_db()` 执行 Upsert：`TrackedProduct` 不存在则插入、存在则更新；`PriceSnapshot` 每次抓取新增一条。
- **后台任务**：`tasks.py` 的 `/api/v1/tasks/search` 使用 `BackgroundTasks` 调用调度器，避免请求超时。

### 3. 前端架构

- **主仪表盘**（React + Vite + TypeScript）入口为 `src/App.tsx`，包含三个标签页：
  - `overview`：市场分析大盘，使用 Recharts 绘制价格段组合图、销量面积图、价格-评论散点图、品牌 TOP10 横向柱状图。
  - `scraper`：爬虫控制中心，输入关键词发起抓取，显示任务实时日志终端。
  - `database`：追踪商品库，支持按类目过滤、排序、批量软删除、查看单品价格趋势与评论深度分析。
- **评论深度分析**：`src/components/ReviewAnalysisModal.tsx` 以右侧抽屉形式展示评分分布、情感占比、关键词、评论时间趋势和近期评论列表。数据来自 `GET /api/v1/products/{sku}/reviews`。
- **类目过滤**：大盘和商品库的类目 Tab 是从成功任务 `query` 字段动态提取的，不是静态分类。
- **销量估算**：前端 `salesDistribution` 中使用经验公式：`estimatedSales = review_count * 38 + 1500 / max(price, 10) + rating * 20`，仅用于可视化参考。
- **API 基地址**：`src/api.ts` 中硬编码为 `http://localhost:8000/api/v1`，开发时需确保后端在该地址运行。

### 4. 配置项

关键环境变量在 `noon_api/.env` 中配置：

- `DATABASE_URL`：数据库连接，开发默认 SQLite。
- `SCRAPER_PROVIDER`：`scraperapi` / `oxylabs` / `fetcher`。
- `SCRAPERAPI_KEY` / `SCRAPERAPI_URL`：ScraperAPI 密钥与地址。
- `OXYLABS_USERNAME` / `OXYLABS_PASSWORD` / `OXYLABS_API_URL`：Oxylabs 凭据。
- `WEBHOOK_SECRET`：Oxylabs Webhook 验证密钥。

### 5. 开发注意事项

- 后端默认开启 CORS（`allow_origins=["*"]`），仅用于本地开发。
- `noon_api/noon_data.db` 是已初始化的 SQLite 数据库文件，包含结构和数据。
- 删除商品是软删除（`status = 'INACTIVE'`），不会影响已存在的历史快照，但会从大盘统计中排除。
- 前端 `npm run build` 会先运行 TypeScript 编译检查，再执行 Vite 构建。
- Oxlint 配置位于 `noon_dashboard/.oxlintrc.json`。
- 评论抓取依赖 Playwright Firefox 浏览器二进制；新环境或部署后需执行 `playwright install firefox`。
- Akamai Bot Manager 可能针对具体 IP/指纹动态拦截；代码已将 508 / `sec-if-cpt-container` 识别为 `intercepted` 状态并透传给前端，不会静默失败。
