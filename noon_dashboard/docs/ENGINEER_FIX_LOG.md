# 工程师修复日志 · QA 第 1 轮 2 个源码 Bug

> 执行角色：工程师（software-engineer 子类型系统故障，general-purpose 临时补位）
> 修复对象：QA 报告 `docs/QA_REPORT.md` 中的 BUG-1（阻断性）与 BUG-2（中危语义不一致）
> 日期：2026-07-09
> 原则：最小变更，只改这 2 个 Bug，不动其他逻辑；真实修复、真实验证。

---

## 1. BUG-1（阻断性）— `Field` 未 import

| 项 | 内容 |
|---|---|
| 文件 | `noon_api/app/schemas/product.py` |
| 位置 | 第 7 行 |
| 现状（QA 报告时） | `from pydantic import BaseModel, ConfigDict` —— 缺 `Field`，`BrandRankItem` 用了 `Field(alias=...)` → 模块加载 `NameError` → 全部 `/products/` 接口 500 |
| 修复 | `from pydantic import BaseModel, ConfigDict, Field` |
| 实际发现 | **到达修复时该行已是修复后状态**（`Field` 已在 import 列表中），判断为 QA 报告产出后、本轮介入前已被前序步骤修复。本轮经静态读 + 动态 import 验证确认无误，未做重复改动。 |

**验证**（`C:/tmp/qa_venv`）：
```
[PASS] B1 import: Field 已导入 -- Field attr=True
[PASS] B1 import: BrandRankItem 可用
[PASS] B1 import: BrandRankItem alias 实例化 -- {'name': 'x', '商品数': 1, '总评论': 2, '均分': 4.5}
```
`BrandRankItem(name=..., 商品数=..., 总评论=..., 均分=...)` 可用中文 alias 实例化，`populate_by_name=True` 生效，模块加载无 `NameError`。

---

## 2. BUG-2（中危）— 「未分类」tab 前后端口径不一致

### 根因
- 前端 `useGlobalFilters.ts` 直接用后端 `/stats/categories` 返回值渲染 tab 计数；`categoryParam` 取对应 `value` 传给后端。
- 后端 `/stats/categories`：仅把 `NULL/空` category 归入未分类，未知英文类目（如 `n51575169a`）走 `get_chinese_label` 被 GoogleTranslator 翻译成各种中文标签 → 未分类 tab 计数偏小。
- 后端 `_build_where` 的 `__UNCATEGORIZED__`：仅匹配 `category IS NULL OR category=''`（本库 0 条）→ 列表 0 条。
- 结果：tab 计数 ≠ 点击过滤结果，体验断裂。

### 修复方案（按主理人裁决方向）

**文件**：`noon_api/app/api/products.py`，共 3 处改动：

#### 改动 1 — 定义 `KNOWN_CATEGORIES_LOWER` 常量（第 31-54 行）
在 `UNCATEGORIZED_PARAM` 附近新增常量，与前端 `categoryMap.ts` 的 `CATEGORY_LABEL_TO_ENGLISH` 所有英文 value 完全对齐（小写形式，共 53 个值）：
```python
KNOWN_CATEGORIES_LOWER: frozenset[str] = frozenset({
    'massage gun', 'massage guns', 'massage muscle stimulators', 'massager',
    'neck massager', 'eye massager',
    'handheld fan',
    'ice tray', 'ice mold', 'ice cube trays', 'ice cube tray',
    ... # 共 18 个中文类目对应的 53 个英文值
})
```
该集合与后端 `category_mapping.py` 的 `CATEGORY_MAP[*]["raw"]` 完全一致（双向核对）。

#### 改动 2 — 扩展 `_build_where` 的 `__UNCATEGORIZED__` 分支（第 92-99 行）
```python
if category == UNCATEGORIZED_PARAM:
    conditions.append(
        or_(
            TrackedProduct.category.is_(None),
            TrackedProduct.category == '',
            ~func.lower(TrackedProduct.category).in_(KNOWN_CATEGORIES_LOWER),
        )
    )
```
- 使用 SQLAlchemy `or_` + `func.lower().in_()` 参数化构造，**未拼 SQL 字符串**，无注入风险。
- SQLite `func.lower()` / `LOWER()` 兼容。
- 已知类目仍走 `else` 分支的 `.in_(values)` 精确匹配（多值逗号串逻辑不变）。

#### 改动 3 — 对齐 `/stats/categories` 未分类计数（第 317-327 行）
```python
for cat_val, count in rows:
    if not cat_val:
        uncategorized_count += count
        continue
    # 不在已知类目集合内的原始 category 归入"未分类"
    if cat_val.lower().strip() not in KNOWN_CATEGORIES_LOWER:
        uncategorized_count += count
        continue
    valid_cats.append(cat_val)
    cat_to_count[cat_val] = count
```
- 未知英文类目在调 `get_chinese_label` 之前即归入未分类，不再触发 GoogleTranslator（顺带消除该路径对翻译服务的依赖与副作用）。
- `__UNCATEGORIZED__` 哨兵字面量前后端一致。

### 验证（`C:/tmp/qa_venv` + `C:/tmp/qa_noon` 副本，11/11 PASS）
```
[PASS] B2 KNOWN_CATEGORIES_LOWER 已定义 -- size=53
[PASS] B2 已知类目抽样(power bank/massage gun)
[PASS] B2 未知类目抽样(n51575169a 不在集合)
[PASS] B2 /stats/categories 返回 200 -- status=200
    [info] /stats/categories 共 7 组；未分类 tab count=1
    [info] __UNCATEGORIZED__ _build_where count=1
    [info] 命中 category 分布: [('n51575169a', 1)]
[PASS] B2 口径一致: tab_count == _build_where count -- tab=1 vs where=1
[PASS] B2 __UNCATEGORIZED__ 命中无已知类目混入 -- bad=[]
[PASS] B2 categories 计数守恒 = ACTIVE 总数 -- sum=3118 active=3118
[PASS] B2 已知类目未回归(按摩器 tab 存在) -- 按摩器={'label': '按摩器', 'value': 'massage gun,neck massager', 'count': 684}
```

**口径一致性结论**：`/stats/categories` 未分类 tab count（1）== `_build_where(__UNCATEGORIZED__)` count（1），不再出现"tab N / 列表 0"的断裂。命中 category 为 `n51575169a`（未知英文，不在 `KNOWN_CATEGORIES_LOWER`），无已知类目混入；已知类目 tab（按摩器=684 等）未回归；categories 计数守恒 = ACTIVE 总数（3118）。

---

## 3. 偏离点与说明

1. **BUG-1 到达时已修复**：本轮介入时 `schemas/product.py` 第 7 行已含 `Field`，判断为前序步骤已修；本轮仅做静态确认 + 动态 import 验证，未重复改动。
2. **QA 副本 `_to_item` 的 `sold_recently` 限制**：`list_products` / `stats/overview` 端点的 `_to_item` 在 QA 副本（`C:/tmp/qa_noon`）会因 `PriceSnapshot` model 缺 `sold_recently` 字段报 `AttributeError`。这是 QA 副本为规避重依赖精简 model 所致，**真实源码 `app/models/product.py:83` 有 `sold_recently` 字段**，非本次 Bug。故 BUG-2 的列表 total 验证改用 `_build_where` + 直接 DB `count()` 查询（不依赖 `_to_item`），等价验证了 `__UNCATEGORIZED__` 过滤口径；`/stats/categories` 端点（不走 `_to_item`）走真实 HTTP TestClient 验证通过。
3. **未分类计数绝对值与 QA 报告差异**：QA 报告称未分类=198（含 `power bank=197`）。本轮验证副本数据库中未分类=1（`n51575169a`），因 `power bank` 属于 `KNOWN_CATEGORIES_LOWER`（映射"充电宝"），正确归入"充电宝"tab 而非未分类。该差异源于前端 `aggregateToLabels`（QA 报告引用）与现网 `useGlobalFilters.ts`（直接用后端返回）口径不同——本轮按主理人裁决以 `categoryMap.ts` 英文集合为基准统一，`power bank` 归"充电宝"符合映射表定义。
4. **未改动项**：`products.py` 第 70-71 行存在 `UNCATEGORIZED_PARAM` 重复定义（原已存在），属最小变更范围外，未触碰；`_to_item` / `get_chinese_label` / 排序白名单 / overview 算法等均未改动。

---

## 4. 修改文件清单

| 文件 | 改动 | 行数 |
|---|---|---|
| `noon_api/app/schemas/product.py` | 无（到达时已修复，仅验证） | — |
| `noon_api/app/api/products.py` | 新增 `KNOWN_CATEGORIES_LOWER`；扩展 `_build_where` 未分类分支；对齐 `/stats/categories` 未分类计数 | +28 / 改 2 处 |

## 5. 验证脚本
`C:/tmp/qa_noon/verify_fix.py`（复用 QA 的 `qa_venv` + `qa_noon` 副本 + stub 注入，仅测试进程内生效，未改源码）。
