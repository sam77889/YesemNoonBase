# Dynamic Category Auto-Translation Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Uncategorized" mismatch bug and enable dynamic auto-translated category tabs by moving category mapping and translation to the backend.

**Architecture:** Add a translation cache table to SQLite, modify the backend `/stats/categories` endpoint to return localized `label`/`value` objects by translating unknown categories with GoogleTranslator, and simplify the frontend to dynamically render these tabs.

**Tech Stack:** FastAPI, SQLAlchemy, SQLite, React, TypeScript.

## Global Constraints

- No structural changes to unrelated code.
- Must preserve existing `__UNCATEGORIZED__` filtering logic for null/empty categories.
- Frontend must send exact backend-provided `value` string on tab clicks.

---

### Task 1: Database Model and Schema Update

**Files:**
- Modify: `noon_api/app/models/product.py`
- Create: `noon_api/create_translation_table.py`
- Create: `noon_api/tests/test_translation_model.py`

**Interfaces:**
- Produces: `CategoryTranslation` model for SQLAlchemy.

- [ ] **Step 1: Write the failing test**

```python
# noon_api/tests/test_translation_model.py
import pytest
from app.models.product import CategoryTranslation

def test_category_translation_model():
    model = CategoryTranslation(english_name="power bank", chinese_label="充电宝")
    assert model.english_name == "power bank"
    assert model.chinese_label == "充电宝"
    assert CategoryTranslation.__tablename__ == "category_translations"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noon_api && PYTHONPATH=. pytest tests/test_translation_model.py -v`
Expected: FAIL with "ImportError" or "NameError"

- [ ] **Step 3: Write minimal implementation**

Modify `noon_api/app/models/product.py` by adding the following at the end of the file:

```python
class CategoryTranslation(Base):
    __tablename__ = "category_translations"

    english_name = Column(String, primary_key=True, index=True)
    chinese_label = Column(String, nullable=False)
```

Create a script `noon_api/create_translation_table.py` to create the table in SQLite since there are no Alembic migrations explicitly configured in the project:

```python
# noon_api/create_translation_table.py
import asyncio
from app.models.database import engine
from app.models.product import CategoryTranslation

async def init_models():
    async with engine.begin() as conn:
        await conn.run_sync(CategoryTranslation.__table__.create, checkfirst=True)

if __name__ == "__main__":
    asyncio.run(init_models())
```

- [ ] **Step 4: Run test to verify it passes & execute script**

Run: `cd noon_api && PYTHONPATH=. pytest tests/test_translation_model.py -v`
Expected: PASS
Run: `cd noon_api && PYTHONPATH=. python create_translation_table.py`
Expected: Script completes without error.

- [ ] **Step 5: Commit**

```bash
git add noon_api/app/models/product.py noon_api/create_translation_table.py noon_api/tests/test_translation_model.py
git commit -m "feat(api): Add CategoryTranslation model and table creation script"
```

### Task 2: Backend API and Translation Logic Update

**Files:**
- Modify: `noon_api/app/schemas/product.py`
- Modify: `noon_api/app/api/products.py`
- Modify: `noon_api/app/services/category_mapping.py`
- Create: `noon_api/tests/test_category_stats.py`

**Interfaces:**
- Consumes: `CategoryTranslation` model.
- Produces: `CategoryCount` schema with `{ label, value, count }`.

- [ ] **Step 1: Write the failing test**

```python
# noon_api/tests/test_category_stats.py
import pytest
from app.schemas.product import CategoryCount
from app.services.category_mapping import get_chinese_label

def test_category_count_schema():
    c = CategoryCount(label="按摩器", value="massage gun", count=10)
    assert c.label == "按摩器"
    assert c.value == "massage gun"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noon_api && PYTHONPATH=. pytest tests/test_category_stats.py -v`
Expected: FAIL because schema expects `category` not `label`/`value`.

- [ ] **Step 3: Write minimal implementation**

Modify `noon_api/app/schemas/product.py`:
Change `CategoryCount` to:
```python
class CategoryCount(BaseModel):
    label: str
    value: str
    count: int
```

Modify `noon_api/app/services/category_mapping.py`:
Add the following imports and function:
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.product import CategoryTranslation
from deep_translator import GoogleTranslator

async def get_chinese_label(category_val: str, db: AsyncSession) -> str:
    # Check manual mapping first
    c = category_val.lower().strip()
    for zh_label, rules in CATEGORY_MAP.items():
        if c in rules.get("raw", []):
            return zh_label
    
    # Check DB cache
    stmt = select(CategoryTranslation).where(CategoryTranslation.english_name == c)
    result = await db.execute(stmt)
    cached = result.scalar_one_or_none()
    if cached:
        return cached.chinese_label

    # Auto-translate
    try:
        translator = GoogleTranslator(source='auto', target='zh-CN')
        zh_label = translator.translate(c)
        if not zh_label:
            zh_label = category_val
    except Exception:
        zh_label = category_val

    # Save to cache
    new_trans = CategoryTranslation(english_name=c, chinese_label=zh_label)
    db.add(new_trans)
    await db.commit()
    
    return zh_label
```

Modify `noon_api/app/api/products.py`:
Update `get_category_counts`:
```python
from app.services.category_mapping import get_chinese_label

@router.get("/stats/categories", response_model=list[CategoryCount])
async def get_category_counts(db: AsyncSession = Depends(get_db)):
    """按原始英文类目（含空类目）分组计数，供前端反查中文标签 tab。"""
    stmt = (
        select(TrackedProduct.category, func.count())
        .where(TrackedProduct.status == "ACTIVE")
        .group_by(TrackedProduct.category)
    )
    rows = (await db.execute(stmt)).all()

    label_counts = {}
    label_values = {}
    uncategorized_count = 0

    for cat_val, count in rows:
        if not cat_val:
            uncategorized_count += count
            continue
        
        zh_label = await get_chinese_label(cat_val, db)
        
        if zh_label not in label_counts:
            label_counts[zh_label] = 0
            label_values[zh_label] = []
        
        label_counts[zh_label] += count
        label_values[zh_label].append(cat_val.strip())

    result = []
    for label, count in label_counts.items():
        val_str = ",".join(label_values[label])
        result.append(CategoryCount(label=label, value=val_str, count=count))

    if uncategorized_count > 0:
        result.append(CategoryCount(label="未分类", value=UNCATEGORIZED_PARAM, count=uncategorized_count))

    result.sort(key=lambda x: x.count, reverse=True)
    return result
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noon_api && PYTHONPATH=. pytest tests/test_category_stats.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add noon_api/app/schemas/product.py noon_api/app/api/products.py noon_api/app/services/category_mapping.py noon_api/tests/test_category_stats.py
git commit -m "feat(api): Update category stats endpoint with auto-translation and new schema"
```

### Task 3: Frontend Simplification and Dynamic Tabs

**Files:**
- Modify: `noon_dashboard/src/types/index.ts`
- Remove: `noon_dashboard/src/lib/categoryMap.ts`
- Modify: `noon_dashboard/src/hooks/useGlobalFilters.ts`

**Interfaces:**
- Consumes: `CategoryCount` backend schema.

- [ ] **Step 1: Write the failing test**

We won't write a traditional test for TypeScript types, but the TypeScript compiler will act as our test.

Run: `cd noon_dashboard && npm run build`
Expected: Currently passes.

- [ ] **Step 2: Write minimal implementation**

Modify `noon_dashboard/src/types/index.ts`:
Change `CategoryCount` interface:
```typescript
export interface CategoryCount {
  label: string;
  value: string;
  count: number;
}
```

Remove `noon_dashboard/src/lib/categoryMap.ts`:
```bash
rm noon_dashboard/src/lib/categoryMap.ts
```

Modify `noon_dashboard/src/hooks/useGlobalFilters.ts`:
```typescript
import { useMemo } from 'react';
import type { CategoryCount } from '../types';

export function useGlobalFilters(
  rawCounts: CategoryCount[],
  currentCategory: string | null
) {
  // Directly use the backend-provided rawCounts for tabs
  const categoryTabs = useMemo(() => {
    return rawCounts.map(item => [item.label, item.count] as [string, number]);
  }, [rawCounts]);

  const setCategoryLabel = (label: string | null) => {
    if (!label) {
      window.dispatchEvent(new CustomEvent('filter-change', {
        detail: { category: null }
      }));
      return;
    }
    const match = rawCounts.find(c => c.label === label);
    if (match) {
      window.dispatchEvent(new CustomEvent('filter-change', {
        detail: { category: match.value }
      }));
    }
  };

  const currentLabel = useMemo(() => {
    if (!currentCategory) return null;
    const match = rawCounts.find(c => c.value === currentCategory);
    return match ? match.label : null;
  }, [currentCategory, rawCounts]);

  return { categoryTabs, currentLabel, setCategoryLabel };
}
```

- [ ] **Step 3: Run TypeScript compiler to verify it passes**

Run: `cd noon_dashboard && npx tsc --noEmit`
Expected: PASS (No type errors).

- [ ] **Step 4: Commit**

```bash
git add noon_dashboard/src/types/index.ts noon_dashboard/src/hooks/useGlobalFilters.ts noon_dashboard/src/lib/categoryMap.ts
git commit -m "fix(ui): Remove categoryMap hardcoding and use backend dynamic tabs to fix BUG-2"
```
