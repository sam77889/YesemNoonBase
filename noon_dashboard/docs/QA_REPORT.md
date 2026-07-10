# QA 验证报告 · 性能优化 P0-1 / P0-2 / P0-3 / Q3

> 执行角色：QA 工程师（临时补位）
> 验证对象：`noon_dashboard`（前端）/ `noon_api`（后端）已实现代码
> 依据：`docs/ARCH_PERF_OPT.md`、`docs/PRD_PERF_OPT.md`、`docs/ENGINEER_IMPL_LOG.md`
> 日期：2026-07-09
> 原则：**真实跑、真实记**，不伪造任何结果；源码 Bug 不改源码，仅记录并转主理人。

---

## 0. 验证环境与手段（如实记录）

| 项 | 情况 |
|---|---|
| 沙箱系统 | Windows + Git Bash；WSL **未安装**（仅占位，无法运行 Linux 二进制） |
| 后端 venv | `noon_api/venv` 是 **Linux 风格** venv（ELF，Python 3.10.12），Windows 下**无法直接运行** |
| 系统 Python | `C:/Users/Sanny/.workbuddy/.../python 3.13.14`，**无** fastapi/sqlalchemy 等依赖 |
| 网络 | pip 可联网；据此新建本地 Windows venv（`C:/tmp/qa_venv`），仅装**核心依赖**：`fastapi / sqlalchemy[asyncio] / aiosqlite / pydantic / pydantic-settings / httpx`（未装 curl_cffi/playwright/deep-translator 等重依赖） |
| 测试方式 | ① 用 FastAPI `TestClient` 直连 ASGI（无需起端口）；② `products.py` 顶层 import 了爬虫/评论 service，测试前在 `sys.modules` **注入 stub**（仅作用于测试进程，未改源码）规避重依赖；③ 复制 `noon_data.db` 到本地 `C:/tmp/qa_noon/` 作为只读数据源 |
| 前端验证 | 用项目内 `typescript` 把真实 `categoryMap.ts` / `utils.ts` 转译为 JS 后 require 验证（不重实现）；`tsc -b` 独立复核 |
| 注意 | 源码 `app/schemas/product.py` 有阻断性 Bug（见 BUG-1），真实源码**无法 import**。为验证"其余逻辑是否正确"，在**临时副本**（非源码）补 1 行 `Field` import 后跑通，**源码本身仍待工程师修复** |

---

## 1. 测试清单（用例 / 结果 / 通过率）

### 1.1 后端接口冒烟测试（Task A，临时补丁副本上运行）
数据源：`noon_data.db`（ACTIVE=3118，price_snapshots=4695；类目含 `power bank`/`n51575169a` 等未映射英文）

| 编号 | 用例 | 结果 | 说明 |
|---|---|---|---|
| A1.1 | `GET /products/` 返回 200 | ✅ PASS | |
| A1.2 | items 数量 ≤ limit | ✅ PASS | limit=10 → 10 |
| A1.3 | total 正确（ACTIVE=3118） | ✅ PASS | total=3118 |
| A1.4 | skip 翻页数量正确 | ✅ PASS | skip=20 → 10 |
| A1.5 | 翻页数据不重复 | ✅ PASS | skip=0 vs 20 无交集 |
| A1.6 | limit 上限 50000 接受 | ✅ PASS | |
| A2.1 | category=massage gun 精确命中 | ✅ PASS | total=484 |
| A2.2 | category total 与 items 一致 | ✅ PASS | |
| A2.3 | 多值逗号串联合命中 | ✅ PASS | egg boiler+egg cooker |
| A2.4 | 多值 total = 2+934 | ✅ PASS | =936 |
| A2.5 | `__UNCATEGORIZED__` 仅空类目 | ✅ PASS | **total=0**（见 BUG-2） |
| A3.1 | q=yoga 命中非空 | ✅ PASS | total=898 |
| A3.2 | q 命中均含 yoga（不区分大小写，覆盖 title/brand/category） | ✅ PASS | |
| A4.1 | review_count desc 排序正确 | ✅ PASS | |
| A4.2 | review_count asc 排序正确 | ✅ PASS | |
| A4.3 | desc/asc 顺序相反 | ✅ PASS | |
| A4.4 | price 内存排序（desc）正确 | ✅ PASS | 快照派生字段 |
| A4.5 | 非法 sort 回退 updated_at 不崩溃 | ✅ PASS | 白名单防护生效 |
| A5.1 | `/stats/categories` 返回数组 | ✅ PASS | 9 组 |
| A5.2 | categories 计数之和 = ACTIVE(3118) | ✅ PASS | |
| A6.1 | overview 含 4 段结构 | ✅ PASS | summary/price_distribution/price_sales_scatter/brand_ranking |
| A6.2 | summary 字段正确 | ✅ PASS | {total_products,active_products,total_reviews} |
| A6.3 | scatter 截断 ≤500 | ✅ PASS | =500 |
| A6.4 | price_distribution 为桶数组 | ✅ PASS | =20 桶 |
| A6.5 | brand_ranking ≤10 | ✅ PASS | =10 |
| A6.6 | overview 类目过滤 total=936 | ✅ PASS | |
| A6.7 | overview `__UNCATEGORIZED__` 与列表一致 | ✅ PASS | 均为 0 |

**A 类：27/27 PASS**（在源码 Bug 修复后，后端三接口逻辑全部正确）

### 1.2 前端纯函数一致性（Task B，真实 TS 源码转译验证）

| 编号 | 用例 | 结果 |
|---|---|---|
| B1.1 | CATEGORY_LABEL_TO_ENGLISH 键集合与 normalizeCategory 一致 | ✅ PASS |
| B1.2 | 5 个中文标签的英文列表逐条对齐 | ✅ PASS（5/5） |
| B1.3 | 每个英文值经 normalizeCategory 回到对应中文标签 | ✅ PASS（17/17） |
| B3.1~B3.4 | categoryLabelToParam 反查（按摩器/手持风扇/未分类哨兵/未知透传） | ✅ PASS（4/4） |
| B3.5 | aggregateToLabels 聚合（按摩器=684、瑜伽垫=895、未分类=198） | ✅ PASS |
| B2.1 | estimateSales 与文档公式逐样例一致（含 rating/price 缺省 3.5/1） | ✅ PASS |

**B 类（映射对齐）：30/30 PASS**

### 1.3 后端 overview 算法 vs 文档算法 数值一致性（B2，Python 独立复刻对比）

| 编号 | 用例 | 结果 |
|---|---|---|
| — | estimateSales 抽样一致（50 例） | ✅ PASS |
| — | price_distribution 桶数 / 各桶计数·评论一致 / 标签格式 int-int | ✅ PASS（3/3） |
| — | scatter 长度(截断500) / 内容多集合一致 / 降序 | ✅ PASS（3/3） |
| — | brand_ranking 长度≤10 / 内容一致 / 截断≤13字符 / 降序 | ✅ PASS（4/3→4/4） |

**B2 类（算法一致性）：11/11 PASS** — 后端 `_compute_overview` 与按 PRD/实现报告独立复刻的算法逐项吻合，无数值漂移。

### 1.4 类型与构建

| 项 | 结果 | 说明 |
|---|---|---|
| `tsc -b`（前端） | ✅ TSC_EXIT=0 | 独立复核零类型错误，印证工程师结论 |
| `vite build`（G1 分包体积） | ❌ 环境限制 | 见第 3 节，沙箱无法跑，最大单 chunk ≤380KB **未实测** |

---

## 2. 智能路由判定结论

| 发现 | 类型 | 路由 | 处理 |
|---|---|---|---|
| **BUG-1**：`app/schemas/product.py` 的 `BrandRankItem` 使用 `Field(alias=...)`，但文件仅 `from pydantic import BaseModel, ConfigDict`，**未 import `Field`** → 模块加载即 `NameError` → 整个 `app/api/products.py` 路由无法加载，**所有 `/api/v1/products/` 接口（列表/分页/过滤/排序/stats/categories/stats/overview/详情/增删）均返回 500** | 源码 Bug（阻断性） | **→ Engineer（主理人转工程师修复）** | 不改源码；仅在临时副本补 1 行验证其余逻辑；修复建议：在 `schemas/product.py` 第 7 行改为 `from pydantic import BaseModel, ConfigDict, Field` |
| **BUG-2**：「未分类」tab 语义前后端不一致。前端 `aggregateToLabels` 把**未知英文类目**（`power bank`=197、`n51575169a`=1，本库共 198）归入"未分类"tab（显示计数 198）；但点击该 tab 传给后端的是 `__UNCATEGORIZED__`，后端只匹配 `category IS NULL OR category=''`（本库 **0** 条）。结果：tab 显示"未分类 (198)"，点击后列表**显示 0 条** | 源码/逻辑 Bug（功能性不一致，中危） | **→ Engineer（主理人转工程师修复）** | 不改源码；建议统一口径（如后端 `__UNCATEGORIZED__` 也覆盖"不在已知映射集合内的英文类目"，或前端 `aggregateToLabels` 不再把未知英文并入未分类，或 categories 接口按前端同一口径计算未分类计数） |
| 测试/stub 注入、临时副本补丁、`/tmp` 脚本 | 测试/脚本 | QA 自行处理 | 仅测试进程内生效，不触碰源码 |
| vite build 分包体积（G1） | 环境限制 | **→ NoOne（需本地磁盘/映射盘复测）** | 见第 3 节 |

> 路由摘要：**2 个源码 Bug 路由给 Engineer**；C 类环境限制路由给 NoOne（非代码问题）。

---

## 3. 遗留问题 + 无法在沙箱验证的项（明确标注）

1. **【源码 Bug·阻断】BUG-1 未修复前，所有 `/products/` 接口在生产真实源码下 500。** 本次 27 项后端用例是在"临时副本补 `Field` import"后才跑通的，用于证明**除该 import 缺失外其余逻辑全部正确**。真实源码必须先修此行。
2. **【源码 Bug·中危】BUG-2 未分类 tab 计数与过滤结果不一致**，需工程师统一口径（见上）。
3. **【G1·无法沙箱验证】最大单 chunk ≤380KB 未实测。** `vite build` 在本沙箱（UNC 网络路径 `\\192.168.31.99\...` + Vite8/rolldown）配置加载阶段即报 `Failed to resolve entry for package "vite"`（已真实复现，非推断）。**需在本地磁盘（如 `C:\` 映射盘）或正常 Linux 环境执行 `npm run build` 后实测各 chunk 体积**，确认 `react-vendor/recharts/framer-motion/tanstack` 各 chunk ≤380KB（gzip 前）；若 `recharts` 超标需进一步拆 d3 子依赖。此项 G1 验收标准**当前状态=未验证**。
4. **【G2/G3/G4/G5 部分】**：
   - G4（App.tsx ≤150 行）：实测 **118 行** ✅ 达标（代码静态统计）。
   - G3（不再 `limit=10000`、默认 pageSize ≤50）：前端 `useProducts` 参数化、pageSize 默认 50、选项 `[10,20,50,100]` 已落实 ✅（经源码核查 + 类型复核）。
   - G5（6 tab 可访问、抓取链路不变）：代码结构经核查保持（懒加载 Suspense、useScrapeController 终态 invalid 增 overview/categories）；但**浏览器内交互（实际点击翻页/排序/抓取→轮询→刷新链路）未在沙箱运行**（无前端运行环境 + 无 vitest），属"需本地/浏览器复测"。
   - G2（LCP/FCP 弱网）：需 Lighthouse/DevTools 实测，**沙箱无法测**。
5. **【已知设计偏差·信息项，非 Bug】** 后端 `list_products` 排序白名单额外含 `sku`（前端 `SortState` 未暴露 `sku`）。后端为前端白名单的超集，无功能缺陷，仅记录。
6. **【Q2 边界·信息项】** 本库 NULL/空类目为 0，"未分类"实际由未知英文类目构成（见 BUG-2），与设计文档假设的"空类目→未分类"场景不同，是 BUG-2 的根因。

---

## 4. 总体验证结论

- **已验证通过（真实跑通）**：
  - 后端三接口（列表分页/过滤/排序、stats/categories、stats/overview）逻辑**全部正确**：27/27 用例通过（含分页边界、category 多值、q 三字段搜索、sort 白名单防护、scatter 截断 500、IQR 桶、品牌 TOP10、summary 语义对齐）。
  - 前端映射一致性：categoryMap ↔ normalizeCategory 类目分支逐条对齐（30/30）；`categoryLabelToParam` 反查正确；`estimateSales` 与文档公式一致。
  - 后端 overview 算法与文档（前端原）算法数值完全一致（11/11），无回归漂移。
  - 前端 `tsc -b` 零类型错误（独立复核 TSC_EXIT=0）。
  - App.tsx 118 行 ≤150（G4 达标）；`limit=10000` 已移除、pageSize 收敛（G3 达标，源码核查）。

- **发现并上报的源码缺陷（路由 Engineer）**：
  - **BUG-1（阻断）**：`schemas/product.py` 缺 `Field` import → 全 `/products/` 接口 500。修复 1 行即可，其余逻辑已验证正确。
  - **BUG-2（中危）**：未分类 tab 计数（198）与点击过滤结果（0）不一致，前后端"未分类"语义未对齐。

- **未能在沙箱验证（环境限制，路由 NoOne）**：
  - **G1**：`vite build` 在 UNC+rolldown 下配置加载失败，最大单 chunk ≤380KB **未实测**，需本地磁盘复测。
  - **G2 / G5 浏览器交互**：LCP/FCP 与真实点击链路需在本地浏览器/Lighthouse 复测。

**结论**：P0 三件套的**代码逻辑与算法正确性已通过真实自动化验证（69 项自动化用例全过）**，但**真实源码存在 1 个阻断性 import 缺陷（BUG-1）与 1 个中危语义不一致（BUG-2），在 BUG-1 修复前生产环境 `/products/` 接口不可用**；且 G1 分包体积因沙箱环境限制**尚未实测**，须在主理人本地环境补测。建议：优先修 BUG-1 → 修 BUG-2 → 本地跑 `npm run build` 与浏览器交互复测后，方可判定 P0 验收完成。

---

## 附：复现命令（沙箱已用，验证后可清理）

```
# 后端（临时副本 C:/tmp/qa_noon，已注入 stub + 补 Field import + 复制 noon_data.db）
C:/tmp/qa_venv/Scripts/python C:/tmp/qa_noon/test_backend.py     # A 类 27 用例
C:/tmp/qa_venv/Scripts/python C:/tmp/qa_noon/test_b2_algo.py    # B2 算法 11 用例
# 前端
node C:/tmp/qa_noon/test_frontend_b.cjs                          # B 类 30 用例
# 类型/构建
node ./node_modules/typescript/bin/tsc -b                        # TSC_EXIT=0
node ./node_modules/vite/bin/vite.js build                       # 报 Failed to resolve entry for package "vite"（G1 环境限制）
```
