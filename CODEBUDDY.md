# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

# NOON Base - 跨境电商洞察与智能爬虫系统

针对中东电商 NOON 平台的一站式数据抓取、清洗与可视化大盘。采用前后端分离 + 认证代理的 Monorepo 结构。

## 仓库结构（四大子项目）

```text
noon_base/
├── noon_api/          # Python FastAPI 后端 + Streamlit 备用仪表盘（核心业务逻辑）
├── noon_dashboard/    # React 19 + Vite + TypeScript 主仪表盘（推荐 UI）
├── noon_proxy/        # Express 5 认证代理（生产环境 Cloudflare Tunnel 入口）
└── noon_scraper/      # 独立的 curl_cffi 爬虫模块（无需付费 API，直接绕过 Akamai）
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
cp .env.example .env   # 编辑 .env：填 SCRAPERAPI_KEY 或 OXYLABS 凭据
```

启动后端（开发）：

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
# 配置 .env：NOON_USER / NOON_PASS / SESSION_SECRET / API_URL（默认 http://127.0.0.1:8001）
npm start          # 监听 127.0.0.1:3000
```

### 独立爬虫模块（`noon_scraper/`）

```bash
cd noon_scraper
pip install -r requirements.txt   # curl_cffi, beautifulsoup4, lxml
```

```python
import asyncio
from noon_scraper import AsyncNoonScraper

async def main():
    async with AsyncNoonScraper(concurrency=5) as scraper:
        products = await scraper.search("massage gun", max_pages=10)

asyncio.run(main())
```

## 架构总览

### 1. 整体拓扑

- **本地开发**：浏览器直连 React dev server（5173）→ FastAPI（8000）。前端 `api.ts` 的 `baseURL` 为相对路径 `/api/v1`，本地纯前端开发时可临时改为 `http://localhost:8001/api/v1`。
- **生产部署**：`Browser → Cloudflare Edge → cloudflared → noon_proxy(127.0.0.1:3000)`。代理做三件事：会话认证（登录页 + session cookie）、托管 `noon_dashboard/dist` 静态文件、将 `/api/*` 与 WebSocket 反代到 FastAPI（默认 `API_URL=http://127.0.0.1:8001`）。
- **端口约定**：`start_all.sh` 用 8000；生产代理默认回源到 8001。修改任一处需同步另一处配置。代理会把被 Express 剥离的 `/api` 前缀重新拼回再转发给 FastAPI。

### 2. 后端架构（`noon_api/app/`）

- **框架**：FastAPI + 异步 SQLAlchemy（`AsyncSession`）。`app/main.py` 注册三个路由：`products`、`tasks`、`webhook`，均在 `/api/v1` 前缀下。
- **配置**：`app/config.py` 用 `pydantic-settings` 从 `.env` 加载，`get_settings()` 经 `lru_cache` 单例化。注意 `config.py` 默认 `DATABASE_URL` 是 PostgreSQL，但 `.env.example` 覆盖为 SQLite——以 `.env` 实际值为准。
- **数据库引擎**：`app/models/database.py` 对 SQLite 跳过连接池参数，对 PostgreSQL 启用 `pool_size=20`。`get_db()` 为 FastAPI 依赖注入；后台任务用 `async_session_maker()` 自建会话。
- **ORM 模型**（`app/models/product.py`）：
  - `TrackedProduct`：以 `sku` 为主键，软删除字段 `status`（`ACTIVE`/`INACTIVE`），关联 `price_snapshots`（`lazy="selectin"`）。
  - `PriceSnapshot`：时序快照，每次抓取新增一条，记录 price/original_price/rating/review_count/discount_percent/raw_data。
- **爬虫调度（策略模式）**：`app/services/scraper_dispatcher.py` 的 `run_search_scrape()` 是抓取唯一入口。支持三个 provider：`fetcher`（本地直连，`app/services/fetcher_scraper.py` 适配 `noon_scraper` 模块，curl_cffi firefox 指纹，免费）、`scraperapi`（`scraperapi.py`，默认）、`oxylabs`（`oxylabs.py`）。`TaskCreate.provider` 可按请求覆盖；未指定时回退到 `SCRAPER_PROVIDER` 环境变量。流程：关键词中文→英文翻译 → 创建 `ScrapingTask` 记录 → 抓取 → 解析 → 清洗 → 入库 → 价格预警。
- **TSR 解析**：NOON 已迁移到 TanStack Router，关键数据在页面内联 JS 对象 `__TSR__` 中。`parse_noon_search_html()` 按优先级尝试：① script JSON → ② `__NEXT_DATA__` → ②.⑤ `catalog_sku:` 正则切分提取（sale_price/name/brand/rating/nudges 品类）→ ③ DOM 选择器降级。
- **并发与清洗**：ScraperAPI 多页抓取用 `asyncio.Semaphore(3)`；两阶段清洗——关键词命中过滤（标题须含任一查询词）+ 全局中位数离群点过滤（价格低于中位数 0.2 倍或高于 4 倍剔除）。
- **ETL 入库**：`app/services/etl.py` 的 `save_products_to_db()` 执行 Upsert（商品不存在则插入、存在则更新基础信息；快照始终新增）。`parse_search_results()` 处理 Oxylabs 结构化 JSON。
- **后台任务**：`tasks.py` 的 `POST /api/v1/tasks/search` 用 FastAPI `BackgroundTasks` 调用调度器，立即返回避免请求超时；日志通过 `_log_cb` 回调实时写入 `task.error_message` 并 commit。
- **关键词翻译**：`keyword_service.py` 从 `keyword_map.json` 加载映射表，未命中调用 Google Translate，支持持久化新映射。`uae-en` 站点需英文关键词。

### 3. 独立爬虫模块（`noon_scraper/`）与 fetcher provider

基于 `curl_cffi` 的 `impersonate="firefox"` 模拟真实浏览器 TLS 指纹（JA3/JA4）绕过 Akamai Bot Manager，**无需付费 API**。实测：无头浏览器与纯 httpx 均被拦截，仅 `firefox` 指纹稳定（`chrome` 指纹返回空页面）。提供同步 `NoonScraper` 与异步 `AsyncNoonScraper`（详情页 `asyncio.Semaphore` 并发），从详情页 JSON-LD `<script type="application/ld+json">` 提取 Product schema，CSS 选择器降级。商品链接过滤规则：`/p/` 且含 `/N`。

该模块已通过 `app/services/fetcher_scraper.py` 适配层接入后端调度器（作为 `fetcher` provider），适配层负责：把仓库根加入 `sys.path` 以导入 `noon_scraper`、将爬虫返回字段映射为 ETL 入库格式（`url→product_url`、`image→image_url`、`seller→seller_name`、price 字符串转 float 等）、按页并发抓取详情页并经 `_log_cb` 回写实时日志。前端 scraper 标签页的「🦊 本地直连」下拉即对应此 provider。`noon_api` venv 需安装 `curl_cffi`（已加入 `requirements.txt`）。

### 4. 前端架构（`noon_dashboard/src/`）

- **技术栈**：React 19 + Vite + TypeScript，Recharts 图表，Framer Motion 动画，lucide-react 图标。Oxlint（`.oxlintrc.json`）。
- **单文件聚合**：`src/App.tsx` 为核心入口，四个标签页：
  - `overview`：市场分析大盘——价格段组合图、预估销量面积图、价格-评论散点图、品牌 TOP10 横向柱状图。
  - `scraper`：付费爬虫控制中心（ScraperAPI / Oxylabs），输入关键词发起抓取，打字机效果实时日志终端（仅显示非 `fetcher-` 任务）。
  - `fetcher`：本地直连爬虫页面（curl_cffi firefox 指纹，免费），专用表单 + 日志终端（仅显示 `job_id` 以 `fetcher-` 开头的任务）。
  - `database`：追踪商品库，类目过滤、排序、批量软删除、单品价格趋势。
- **类目过滤**：大盘与商品库的类目 Tab 从成功任务的 `query` 字段动态提取，非静态分类。
- **销量估算**：`salesDistribution` 用经验公式 `estimatedSales = review_count * 38 + 1500 / max(price, 10) + rating * 20`，仅用于可视化参考。
- **API 层**：`src/api.ts` 的 axios `baseURL` 为相对路径 `/api/v1`（生产同源经代理），需后端在对应地址运行。

### 5. 认证代理（`noon_proxy/server.js`）

Express 5 单文件代理。会话认证基于 `express-session`（内存存储），登录限流 5 次/15 分钟，WebSocket 升级时校验 `connect.sid` 签名后才转发。优雅关闭跟踪 socket 连接集。配置通过 `.env`：`NOON_USER`/`NOON_PASS`（必填，否则退出）/`SESSION_SECRET`/`API_URL`/`STATIC_DIR`/`SECURE_COOKIE`。

## 配置项（`noon_api/.env`）

关键环境变量：

- `DATABASE_URL`：开发默认 `sqlite+aiosqlite:///./noon_data.db`，生产可切 PostgreSQL（`asyncpg`）。
- `SCRAPER_PROVIDER`：`fetcher` / `scraperapi` / `oxylabs`（默认回退值，可被请求体 `provider` 覆盖）。
- `SCRAPERAPI_KEY` / `SCRAPERAPI_URL`：ScraperAPI 凭据与地址。
- `OXYLABS_USERNAME` / `OXYLABS_PASSWORD` / `OXYLABS_API_URL`：Oxylabs 凭据。
- `WEBHOOK_SECRET`：Oxylabs Webhook 验证密钥。

## 开发注意事项

- 后端默认开启 CORS（`allow_origins=["*"]`），仅用于本地开发。
- `noon_api/noon_data.db` 是已初始化的 SQLite 文件，含结构与数据。
- 删除商品是软删除（`status='INACTIVE'`），不影响历史快照，但从大盘统计中排除。
- 前端 `npm run build` 先跑 TypeScript 编译检查再 Vite 构建；构建产物供代理托管。
- Oxlint 配置位于 `noon_dashboard/.oxlintrc.json`。
- 修改 `noon_api` 路由后重启 uvicorn（`--reload` 已自动）。
