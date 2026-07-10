# NOON Dashboard 性能优化增量 PRD

> 文档类型：增量 PRD（仅描述本次性能优化变更，不重写整个产品）
> 项目：NOON Dashboard（React 19 + Vite 8 + TS 6 + TanStack Query）
> 基线来源：`ARCHITECTURE_REVIEW_REPORT.md`（综合评分 5.4/10）
> 负责人：产品经理 许清楚（Xu）
> 日期：2026-07-09

---

## 一、背景与范围

架构评审给出 5.4/10，核心矛盾三点：①上帝组件 `App.tsx`（518 行）；②性能策略空白（单 931KB chunk、全量数据进前端）；③零测试。本 PRD 聚焦评审报告中的 **P0 三件套**，是投入产出比最高、且能为后续补测试扫清结构障碍的优化批次。

**本批次不包含**：路由库引入（P1）、DatabaseTable 子组件拆分（P1）、CI 搭建（P1）、CSS 模块化（P2）、测试补全（P2）。这些留待后续迭代。

| P0 项 | 维度 | 现状实测 | 预期收益 | 估工时 |
|---|---|---|---|---|
| 1. 商品列表服务端分页/过滤/排序 | 3/4 | `useProducts` 拉 `limit=10000` 全量，前端 `filter/sort` | 数据增长后内存与渲染成本不再线性恶化 | 2–3 d |
| 2. 路由级 lazy + manualChunks 分包 | 4/6 | 单 chunk 931KB，无任何代码分割 | 首屏 JS 体积降 40–60%，并行加载 | 1–2 d |
| 3. 拆分 App.tsx 上帝组件 | 2 | 518 行，6+ useState + 抓取编排 + 过滤排序耦合 | 回归风险骤降，可测试性提升 | 2–3 d |

---

## 二、产品目标（可量化）

| 编号 | 目标 | 量化指标 | 现状基线 |
|---|---|---|---|
| G1 | 缩减首屏 JS 体积 | 首屏（大盘总览）加载的 JS ≤ **380KB**（gzip 前），较 931KB 单包下降 **≥55%** | 931KB 单 chunk |
| G2 | 提升首屏加载速度 | 弱网（3G 模拟）首屏 LCP ≤ **3.0s**，FCP ≤ **1.5s** | 无基线（需补测） |
| G3 | 消除全量数据拉取 | 商品列表接口不再传 `limit=10000`，默认每页 ≤ **50 条**，首屏仅拉取当前页 | limit=10000 全量 |
| G4 | 收窄上帝组件 | `App.tsx` 行数 ≤ **150 行**，仅保留布局 + 路由出口 | 518 行 |
| G5 | 不引入回归 | 现有 6 个 tab 全部可正常访问，抓取→轮询→大盘刷新链路功能不变 | — |

---

## 三、用户故事

最终用户为**跨境电商数据运营人员**，日常工作是登录大盘查看商品监控池、发起抓取任务、查看价格趋势与深度分析。

1. **作为数据运营**，我希望大盘首屏秒开，这样我在早会前能快速查看昨日监控数据，而不是盯着白屏等待加载。
2. **作为数据运营**，我希望在数据库 tab 翻页/筛选/排序时只加载我需要的那一页数据，这样即使监控池商品过万，列表操作依然流畅、不卡顿。
3. **作为数据运营**，我希望切换到"深度分析"等重页面时才加载对应代码，而不是首屏就把所有图表库一次性全下载下来，这样移动端弱网下也能快速进入工作台。
4. **作为数据运营**，我希望本次优化后所有现有功能（发起抓取、批量移出监控、价格趋势弹窗）行为完全不变，这样我不需要重新学习操作。

---

## 四、需求池

### P0 — 必做（Must have）

#### P0-1 商品列表改服务端分页/过滤/排序

**需求描述**
将商品列表从"全量拉取 + 前端过滤排序"改为"服务端分页/过滤/排序"。
- `useProducts` 由无参 query 改为**参数化 query**，接收 `{ page, pageSize, category, q, sort, order }`，删除 `limit=10000`。
- 接口请求改为 `/products/?offset={page*pageSize}&limit={pageSize}&category={...}&q={...}&sort={...}&order={...}`（具体参数名以后端实际契约为准，见待确认问题 Q1）。
- `DatabaseTable` 现有的客户端分页/排序（`getPaginationRowModel` / `getSortedRowModel`）改为**受控模式**：分页器、排序点击驱动 query 参数变化，由服务端返回对应页数据，前端不再对全量数据做 `filter/sort`。
- `App.tsx` 中的 `filteredProducts` useMemo（291–314 行）删除，过滤/排序职责下推到 query 参数。
- 支持响应中携带 `total`（总条数），用于分页器显示"共 N 条数据"。

**验收标准**
- [ ] 代码中搜索 `limit=10000` 无结果，`useProducts` 默认 pageSize ≤ 50。
- [ ] 切换类目、输入过滤词、点击排序、翻页时，触发的是带参数的新请求（Network 面板可见 `offset/limit/category/q/sort` 参数），而非前端内存过滤。
- [ ] 数据库 tab 分页器"共 N 条"显示服务端返回的 total，翻页正确。
- [ ] 商品量为 1 万条时，首屏列表渲染 DOM 节点数 ≤ pageSize（不再一次性渲染数百行）。
- [ ] 过滤/排序结果与改造前一致（同样输入得到同样排序结果）。

#### P0-2 路由级 lazy + manualChunks 分包

**需求描述**
- 5 个页面组件（`OverviewPage / ScraperPage / FetcherPage / DatabasePage / AnalysisPage`）及 `SystemLogsPage` 改为 `React.lazy(() => import(...))` 动态导入，外层包裹 `<Suspense fallback={...}>`。
- `vite.config.ts` 增加 `build.rollupOptions.output.manualChunks`，将第三方依赖拆为独立 chunk：`react-vendor`（react/react-dom）、`recharts`、`framer-motion`、`tanstack`（react-query/react-table）等。
- 首屏（大盘总览）只加载必要 chunk，其余页面代码按需加载。

**验收标准**
- [ ] `npm run build` 产物由单 chunk 拆为多个 chunk，最大单个 chunk ≤ **380KB**（gzip 前）。
- [ ] 首屏（进入大盘总览）Network 面板只加载当前页面所需 chunk，未加载 analysis/scraper/fetcher 等页面代码。
- [ ] 切换 tab 时对应 chunk 按需加载，加载期间显示 Suspense fallback（不白屏闪烁）。
- [ ] 第三方依赖（react/recharts/framer-motion）各自独立 chunk，命中长缓存。

#### P0-3 拆分 App.tsx 上帝组件

**需求描述**
将 `App.tsx` 的非布局职责抽出为自定义 hook，`App` 只保留布局 + tab 渲染出口。
- 抽出 `useScrapeController` hook：封装 `triggerScrape` / `pollTaskUntilDone` / 任务状态同步 `useEffect`（219–258 行）/ `executionBlocks` 状态 / `handleExecutionUpdate`，返回 `{ scraping, waitingForLog, executionBlocks, triggerScrape }` 等。
- 抽出 `useGlobalFilters` hook：封装类目/过滤/排序相关状态与 memo（`searchQuery / filterText / selectedCategory / categoryTabs / filteredProducts`），注意 P0-1 完成后 `filteredProducts` 职责下推，本 hook 主要管理类目与过滤词状态。
- `App.tsx` 仅保留：导航布局、抽屉控制、tab 切换、PriceTrendModal 挂载，目标 ≤ 150 行。

**验收标准**
- [ ] `App.tsx` 行数 ≤ 150 行，不含抓取编排逻辑与过滤排序 memo。
- [ ] 新增 `useScrapeController` / `useGlobalFilters` hook 文件，职责单一、可独立测试。
- [ ] 抓取→轮询→大盘刷新链路功能与改造前完全一致（发起抓取后进度更新、终态后刷新 products/stats）。
- [ ] 抽屉开关、Esc 关闭、焦点管理行为不变。

### P1 — 尽量做（Should have）

| 编号 | 需求描述 | 验收标准 |
|---|---|---|
| P1-1 | 纯展示型重组件包 `React.memo`（图表卡片、表格行） | 父组件 state 变化时，未变更的图表卡片不重渲染（React DevTools Profiler 验证） |
| P1-2 | DatabaseTable 渲染大数据时引入虚拟滚动（`@tanstack/react-virtual`）或限制单页 pageSize 上限 | 单页 500 条时不出现明显卡顿（FPS ≥ 50） |
| P1-3 | `normalizeCategory` 类目映射逻辑与后端对齐，避免前后端类目口径不一致 | 类目 tab 数量与排序结果改造前后一致 |

### P2 — 可选（Nice to have）

| 编号 | 需求描述 | 验收标准 |
|---|---|---|
| P2-1 | 补 Lighthouse 性能基线报告，纳入 README | 大盘总览 Lighthouse Performance ≥ 80 |
| P2-2 | Vite `build` 开启 `sourcemap`（生产 hidden，开发开启） | 生产构建可上传 sourcemap 用于错误定位 |

---

## 五、非功能需求

### 性能指标
| 指标 | 目标 | 测量方式 |
|---|---|---|
| 首屏 JS 体积（gzip 前） | ≤ 380KB | `vite build` 产物分析 |
| 首屏 LCP（3G 模拟） | ≤ 3.0s | Lighthouse / Chrome DevTools |
| 首屏 FCP（3G 模拟） | ≤ 1.5s | Lighthouse |
| 商品列表首屏 DOM 行数 | ≤ pageSize（≤50） | DevTools Elements |
| App.tsx 行数 | ≤ 150 | 代码统计 |

### 兼容性
- 浏览器：Chrome/Edge 最新两个大版本、Safari 16+、Firefox 最新版（与现有基线一致，不降级）。
- 移动端响应式布局保持不变。
- 后端 API baseURL（`/api/v1`）与 dev proxy 配置不变。

### 回归要求（不可破坏现有功能）
- 6 个 tab（大盘总览/付费搜查/本地直搜/数据库/深度分析/系统日志）全部可正常访问与切换。
- 抓取任务链路完整：发起抓取 → 进度更新 → 终态刷新 products/stats → 系统日志显示执行块。
- 批量移出监控、价格趋势弹窗、类目 tab、过滤搜索功能行为不变。
- TypeScript 严格编译通过（`tsc -b` 无报错），零 `any` 红线不破。
- 主题切换（明/暗）正常。

---

## 六、待确认问题

| 编号 | 问题 | 影响范围 | 默认假设（如未澄清） |
|---|---|---|---|
| **Q1** | 后端 `/products/` 接口是否已支持服务端分页/过滤/排序参数？具体参数名是什么（`offset/limit` 还是 `page/size`？`category` 还是 `category_label`？`sort` 字段名与 `order` 取值 `asc/desc`？）？返回结构是否含 `total` 总数？ | P0-1 改造范围：若后端已支持则纯前端改造；若不支持需后端先扩接口，前端工期顺延 | 假设后端已支持 `offset/limit/category/q/sort/order` 且返回 `{ items, total }` 结构；若不支持，P0-1 拆为"后端扩接口 + 前端受控分页"两阶段 |
| **Q2** | `normalizeCategory` 是前端将英文类目映射为中文标签的逻辑（如 `massage gun` → 按摩器）。服务端按类目过滤时，是按原始英文 `category` 字段过滤，还是按归一化后的中文标签过滤？后端是否已有等价的类目归一化逻辑？ | P0-1 类目过滤一致性；P1-3 | 假设服务端按原始 `category` 字段过滤，前端类目 tab 仍展示归一化中文标签（前端维护"中文标签→英文 category 列表"的反查映射传给后端） |
| **Q3** | `OverviewPage`（大盘总览）依赖 `products` 全量数据做统计卡片与图表聚合（`stats` 由独立 `/products/stats` 接口提供，但部分图表可能依赖 products 数组）。改为服务端分页后，大盘总览页的图表数据来源是否需要单独的聚合接口，还是继续用 stats 接口？ | P0-1 与 P0-2 的边界：若总览页仍需全量 products 做前端聚合，则 lazy 分包后首屏仍会触发大数据拉取 | 假设总览页图表数据来自 `/products/stats` 聚合接口，不依赖全量 products 数组；需架构师确认 `OverviewPage` 对 `products` 的实际依赖 |
| **Q4** | `DatabaseTable` 当前 page size 选项含 `500`。改服务端分页后是否保留 500 选项（单次请求 500 条）？还是收敛为最大 100？ | P0-1 性能与体验平衡 | 假设收敛为 `[10, 20, 50, 100]`，移除 500 选项 |
| **Q5** | 本次是否一并补 Lighthouse 性能基线测量（需在改造前先跑一次作为"优化前"对照）？ | G2 目标可验证性 | 假设由 QA 在验证阶段补测改造前后对照 |

---

## 七、交付物

- 本 PRD 文档：`docs/PRD_PERF_OPT.md`
- （后续）架构师增量设计文档与任务分解
- （后续）工程师实现代码 + 构建产物体积报告
- （后续）QA 验证报告（含改造前后性能对照）

---

*注：本 PRD 基于 `ARCHITECTURE_REVIEW_REPORT.md` 评审结论与源码实测编写，所有现状数据（518 行、931KB、limit=10000）均已核对。待确认问题 Q1–Q3 为关键路径阻塞项，建议主理人优先与后端确认。*
