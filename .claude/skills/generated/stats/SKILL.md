---
name: stats
description: 'Skill for the Stats area of rinkuzu. 13 symbols across 5 files.'
---

# Stats

13 symbols | 5 files | Cohesion: 93%

## When to Use

- Working with code in `src/`
- Understanding how calculateLevel, xpForNextLevel, levelProgress work
- Modifying stats-related functionality

## Key Files

| File                                          | Symbols                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/dashboard.ts`                        | toWeeklyActivityObject, trimWeeklyActivity, getUserProgressStats, getDashboardQuizList, getDashboardBootstrapData |
| `src/lib/gamification.ts`                     | calculateLevel, xpForNextLevel, levelProgress                                                                     |
| `src/app/[locale]/(app)/admin/stats/page.tsx` | AdminStatsPage, formatDate, getStatusBadge                                                                        |
| `src/app/api/progress/stats/route.ts`         | GET                                                                                                               |
| `src/app/[locale]/(app)/dashboard/page.tsx`   | DashboardPage                                                                                                     |

## Entry Points

Start here when exploring this area:

- **`calculateLevel`** (Function) — `src/lib/gamification.ts:8`
- **`xpForNextLevel`** (Function) — `src/lib/gamification.ts:15`
- **`levelProgress`** (Function) — `src/lib/gamification.ts:25`
- **`getUserProgressStats`** (Function) — `src/lib/dashboard.ts:199`
- **`getDashboardBootstrapData`** (Function) — `src/lib/dashboard.ts:312`

## Key Symbols

| Symbol                      | Type     | File                                          | Line |
| --------------------------- | -------- | --------------------------------------------- | ---- |
| `calculateLevel`            | Function | `src/lib/gamification.ts`                     | 8    |
| `xpForNextLevel`            | Function | `src/lib/gamification.ts`                     | 15   |
| `levelProgress`             | Function | `src/lib/gamification.ts`                     | 25   |
| `getUserProgressStats`      | Function | `src/lib/dashboard.ts`                        | 199  |
| `getDashboardBootstrapData` | Function | `src/lib/dashboard.ts`                        | 312  |
| `GET`                       | Function | `src/app/api/progress/stats/route.ts`         | 7    |
| `DashboardPage`             | Function | `src/app/[locale]/(app)/dashboard/page.tsx`   | 9    |
| `AdminStatsPage`            | Function | `src/app/[locale]/(app)/admin/stats/page.tsx` | 83   |
| `formatDate`                | Function | `src/app/[locale]/(app)/admin/stats/page.tsx` | 122  |
| `getStatusBadge`            | Function | `src/app/[locale]/(app)/admin/stats/page.tsx` | 139  |
| `toWeeklyActivityObject`    | Function | `src/lib/dashboard.ts`                        | 82   |
| `trimWeeklyActivity`        | Function | `src/lib/dashboard.ts`                        | 98   |
| `getDashboardQuizList`      | Function | `src/lib/dashboard.ts`                        | 257  |

## Execution Flows

| Flow                             | Type            | Steps |
| -------------------------------- | --------------- | ----- |
| `DashboardPage → CalculateLevel` | intra_community | 5     |
| `GET → CalculateLevel`           | intra_community | 4     |
| `DashboardPage → ConnectDB`      | cross_community | 4     |
| `DashboardPage → LevelProgress`  | intra_community | 4     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "calculateLevel"})` — see callers and callees
2. `gitnexus_query({query: "stats"})` — find related execution flows
3. Read key files listed above for implementation details
