---
name: admin
description: 'Skill for the Admin area of rinkuzu. 28 symbols across 12 files.'
---

# Admin

28 symbols | 12 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how GET, POST, GET work
- Modifying admin-related functionality

## Key Files

| File                                        | Symbols                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/services/admin/AdminService.ts`        | AdminService, getCategories, createCategory, getReports, updateReportStatus (+8) |
| `src/app/api/admin/setup/route.ts`          | POST, GET                                                                        |
| `src/app/api/admin/categories/route.ts`     | GET, POST                                                                        |
| `src/app/api/admin/reports/[id]/route.ts`   | PATCH, DELETE                                                                    |
| `src/app/api/admin/users/route.ts`          | PUT, DELETE                                                                      |
| `src/lib/serviceFactory.ts`                 | getAdminService                                                                  |
| `src/interfaces/services/IAdminService.ts`  | IAdminService                                                                    |
| `src/app/api/admin/stats/route.ts`          | GET                                                                              |
| `src/app/api/admin/reports/route.ts`        | GET                                                                              |
| `src/app/api/admin/stats/creators/route.ts` | GET                                                                              |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/admin/stats/route.ts:7`
- **`POST`** (Function) — `src/app/api/admin/setup/route.ts:8`
- **`GET`** (Function) — `src/app/api/admin/setup/route.ts:40`
- **`GET`** (Function) — `src/app/api/admin/reports/route.ts:7`
- **`GET`** (Function) — `src/app/api/admin/categories/route.ts:6`

## Key Symbols

| Symbol               | Type      | File                                          | Line |
| -------------------- | --------- | --------------------------------------------- | ---- |
| `AdminService`       | Class     | `src/services/admin/AdminService.ts`          | 14   |
| `GET`                | Function  | `src/app/api/admin/stats/route.ts`            | 7    |
| `POST`               | Function  | `src/app/api/admin/setup/route.ts`            | 8    |
| `GET`                | Function  | `src/app/api/admin/setup/route.ts`            | 40   |
| `GET`                | Function  | `src/app/api/admin/reports/route.ts`          | 7    |
| `GET`                | Function  | `src/app/api/admin/categories/route.ts`       | 6    |
| `POST`               | Function  | `src/app/api/admin/categories/route.ts`       | 41   |
| `GET`                | Function  | `src/app/api/admin/stats/creators/route.ts`   | 7    |
| `GET`                | Function  | `src/app/api/admin/stats/categories/route.ts` | 7    |
| `GET`                | Function  | `src/app/api/admin/stats/activity/route.ts`   | 7    |
| `PATCH`              | Function  | `src/app/api/admin/reports/[id]/route.ts`     | 8    |
| `DELETE`             | Function  | `src/app/api/admin/reports/[id]/route.ts`     | 40   |
| `PUT`                | Function  | `src/app/api/admin/users/route.ts`            | 40   |
| `DELETE`             | Function  | `src/app/api/admin/users/route.ts`            | 83   |
| `IAdminService`      | Interface | `src/interfaces/services/IAdminService.ts`    | 7    |
| `getAdminService`    | Method    | `src/lib/serviceFactory.ts`                   | 103  |
| `getCategories`      | Method    | `src/services/admin/AdminService.ts`          | 23   |
| `createCategory`     | Method    | `src/services/admin/AdminService.ts`          | 67   |
| `getReports`         | Method    | `src/services/admin/AdminService.ts`          | 271  |
| `updateReportStatus` | Method    | `src/services/admin/AdminService.ts`          | 287  |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "admin"})` — find related execution flows
3. Read key files listed above for implementation details
