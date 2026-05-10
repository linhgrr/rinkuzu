---
name: categories
description: 'Skill for the Categories area of rinkuzu. 12 symbols across 2 files.'
---

# Categories

12 symbols | 2 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how AdminCategoriesPage, handlePageChange, openEditModal work
- Modifying categories-related functionality

## Key Files

| File                                               | Symbols                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/admin/categories/page.tsx` | AdminCategoriesPage, handlePageChange, openEditModal, formatDate, resetForm (+5) |
| `src/app/[locale]/(app)/categories/page.tsx`       | CategoriesPage, getCategoryColor                                                 |

## Entry Points

Start here when exploring this area:

- **`AdminCategoriesPage`** (Function) — `src/app/[locale]/(app)/admin/categories/page.tsx:36`
- **`handlePageChange`** (Function) — `src/app/[locale]/(app)/admin/categories/page.tsx:108`
- **`openEditModal`** (Function) — `src/app/[locale]/(app)/admin/categories/page.tsx:127`
- **`formatDate`** (Function) — `src/app/[locale]/(app)/admin/categories/page.tsx:213`
- **`resetForm`** (Function) — `src/app/[locale]/(app)/admin/categories/page.tsx:113`

## Key Symbols

| Symbol                  | Type     | File                                               | Line |
| ----------------------- | -------- | -------------------------------------------------- | ---- |
| `AdminCategoriesPage`   | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 36   |
| `handlePageChange`      | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 108  |
| `openEditModal`         | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 127  |
| `formatDate`            | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 213  |
| `resetForm`             | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 113  |
| `openCreateModal`       | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 122  |
| `closeModals`           | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 138  |
| `handleSubmit`          | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 145  |
| `CategoriesPage`        | Function | `src/app/[locale]/(app)/categories/page.tsx`       | 35   |
| `getCategoryColor`      | Function | `src/app/[locale]/(app)/categories/page.tsx`       | 85   |
| `deleteCategory`        | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 185  |
| `confirmDeleteCategory` | Function | `src/app/[locale]/(app)/admin/categories/page.tsx` | 207  |

## How to Explore

1. `gitnexus_context({name: "AdminCategoriesPage"})` — see callers and callees
2. `gitnexus_query({query: "categories"})` — find related execution flows
3. Read key files listed above for implementation details
