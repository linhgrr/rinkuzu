---
name: category
description: 'Skill for the Category area of rinkuzu. 12 symbols across 8 files.'
---

# Category

12 symbols | 8 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how GET, GET, GET work
- Modifying category-related functionality

## Key Files

| File                                            | Symbols                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/services/category/CategoryService.ts`      | CategoryService, getCategories, getCategoryBySlug, searchCategories, getCategoryStats |
| `src/lib/serviceFactory.ts`                     | getCategoryService                                                                    |
| `src/services/category/CategoryService.test.ts` | createService                                                                         |
| `src/interfaces/services/ICategoryService.ts`   | ICategoryService                                                                      |
| `src/app/api/categories/route.ts`               | GET                                                                                   |
| `src/app/api/categories/stats/route.ts`         | GET                                                                                   |
| `src/app/api/categories/[slug]/route.ts`        | GET                                                                                   |
| `src/app/api/categories/search/route.ts`        | GET                                                                                   |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/categories/route.ts:5`
- **`GET`** (Function) — `src/app/api/categories/stats/route.ts:5`
- **`GET`** (Function) — `src/app/api/categories/[slug]/route.ts:6`
- **`GET`** (Function) — `src/app/api/categories/search/route.ts:9`
- **`CategoryService`** (Class) — `src/services/category/CategoryService.ts:5`

## Key Symbols

| Symbol               | Type      | File                                            | Line |
| -------------------- | --------- | ----------------------------------------------- | ---- |
| `CategoryService`    | Class     | `src/services/category/CategoryService.ts`      | 5    |
| `GET`                | Function  | `src/app/api/categories/route.ts`               | 5    |
| `GET`                | Function  | `src/app/api/categories/stats/route.ts`         | 5    |
| `GET`                | Function  | `src/app/api/categories/[slug]/route.ts`        | 6    |
| `GET`                | Function  | `src/app/api/categories/search/route.ts`        | 9    |
| `ICategoryService`   | Interface | `src/interfaces/services/ICategoryService.ts`   | 13   |
| `getCategoryService` | Method    | `src/lib/serviceFactory.ts`                     | 98   |
| `getCategories`      | Method    | `src/services/category/CategoryService.ts`      | 11   |
| `getCategoryBySlug`  | Method    | `src/services/category/CategoryService.ts`      | 47   |
| `searchCategories`   | Method    | `src/services/category/CategoryService.ts`      | 122  |
| `getCategoryStats`   | Method    | `src/services/category/CategoryService.ts`      | 148  |
| `createService`      | Function  | `src/services/category/CategoryService.test.ts` | 3    |

## Connected Areas

| Area | Connections |
| ---- | ----------- |
| Quiz | 4 calls     |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "category"})` — find related execution flows
3. Read key files listed above for implementation details
