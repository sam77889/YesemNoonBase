# Dynamic Category Auto-Translation & Uncategorized Bug Fix Design

## 1. Context and Problem Statement
Currently, the system suffers from "BUG-2": The frontend groups all unrecognized English categories (like `power bank`) into the "未分类" (Uncategorized) tab, showing a count of 198. However, when clicked, it requests `__UNCATEGORIZED__` from the backend, which strictly filters for `category IS NULL OR category = ''`, resulting in 0 displayed items. Furthermore, the user wants newly scraped products with novel categories to be automatically categorized and given a dedicated tab on the frontend.

## 2. Proposed Architecture
The solution will shift the category grouping and mapping responsibility entirely to the backend, enabling dynamic frontend tabs and fixing the filtering mismatch.

### 2.1 Database Changes
- Add a new SQLAlchemy model `CategoryTranslation` in `noon_api/app/models/product.py` (or a related models file).
- Fields: `english_name` (String, Primary Key/Unique), `chinese_label` (String).
- Purpose: Persist the results of auto-translation so we don't repeatedly call the translation API for known but previously uncategorized items.

### 2.2 Backend API (`/api/v1/products/stats/categories`)
- Instead of returning `[{"category": "power bank", "count": 197}]`, the API will return `[{"label": "充电宝", "value": "power bank", "count": 197}]`.
- **Known Categories:** Use the existing `CATEGORY_MAP` in `category_mapping.py` to aggregate known items (e.g., all `massage gun` variations map to `{"label": "按摩器", "value": "massage gun,...", "count": N}`).
- **Unknown Categories (Auto-Categorization):** When an unmapped category string is encountered:
  1. Check `CategoryTranslation` in the database.
  2. If not found, use `deep_translator.GoogleTranslator` (already imported in the project) to translate the string to Chinese.
  3. Save the result to `CategoryTranslation` and commit.
  4. Yield the translated string as the `label` and the original category as the `value`.
- **True Uncategorized:** Items with a strictly null or empty category string will return `{"label": "未分类", "value": "__UNCATEGORIZED__", "count": N}`.

### 2.3 Frontend Simplification & Bug Fix
- **Type Update:** Update the `CategoryCount` interface to `{ label: string; value: string; count: number }`.
- **Remove Hardcoding:** Delete `src/lib/categoryMap.ts` since the frontend no longer needs to map English to Chinese.
- **Dynamic Tabs Rendering:** The frontend will map over the backend's array to dynamically render all category tabs.
- **Filtering Fix:** Clicking any tab simply passes the `value` back to the `/api/v1/products?category={value}` endpoint. The `__UNCATEGORIZED__` constant is handled natively on both ends, completely resolving the BUG-2 mismatch.

## 3. Review Checklist (Spec Self-Review)
- **Placeholders:** None.
- **Internal Consistency:** The flow from DB table -> Backend Aggregation -> Frontend rendering is consistent. The bug is resolved because the frontend will use the exact `value` string provided by the backend for filtering.
- **Scope:** Perfectly scoped to fix the bug and introduce the requested auto-categorization feature.
- **Ambiguity:** Translation mechanism is well-defined (existing `GoogleTranslator` + new DB table cache).
