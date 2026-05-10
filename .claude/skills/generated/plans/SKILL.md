---
name: plans
description: 'Skill for the Plans area of rinkuzu. 14 symbols across 3 files.'
---

# Plans

14 symbols | 3 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how AdminPlansPage, handleEdit, handleSaveEdit work
- Modifying plans-related functionality

## Key Files

| File                                               | Symbols                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/admin/plans/page.tsx`      | AdminPlansPage, handleEdit, handleSaveEdit, handleCreatePlan, handleFeatureChange (+5) |
| `src/app/api/subscription/plans/route.ts`          | GET, formatDurationDisplay, parseDurationToMonths                                      |
| `src/services/subscription/SubscriptionService.ts` | getSubscriptionPlans                                                                   |

## Entry Points

Start here when exploring this area:

- **`AdminPlansPage`** (Function) — `src/app/[locale]/(app)/admin/plans/page.tsx:45`
- **`handleEdit`** (Function) — `src/app/[locale]/(app)/admin/plans/page.tsx:99`
- **`handleSaveEdit`** (Function) — `src/app/[locale]/(app)/admin/plans/page.tsx:115`
- **`handleCreatePlan`** (Function) — `src/app/[locale]/(app)/admin/plans/page.tsx:144`
- **`handleFeatureChange`** (Function) — `src/app/[locale]/(app)/admin/plans/page.tsx:227`

## Key Symbols

| Symbol                  | Type     | File                                               | Line |
| ----------------------- | -------- | -------------------------------------------------- | ---- |
| `AdminPlansPage`        | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 45   |
| `handleEdit`            | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 99   |
| `handleSaveEdit`        | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 115  |
| `handleCreatePlan`      | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 144  |
| `handleFeatureChange`   | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 227  |
| `addFeature`            | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 239  |
| `removeFeature`         | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 253  |
| `formatCurrency`        | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 265  |
| `GET`                   | Function | `src/app/api/subscription/plans/route.ts`          | 3    |
| `deletePlan`            | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 190  |
| `confirmDeletePlan`     | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 217  |
| `getSubscriptionPlans`  | Method   | `src/services/subscription/SubscriptionService.ts` | 396  |
| `formatDurationDisplay` | Function | `src/app/api/subscription/plans/route.ts`          | 35   |
| `parseDurationToMonths` | Function | `src/app/api/subscription/plans/route.ts`          | 48   |

## Execution Flows

| Flow                             | Type            | Steps |
| -------------------------------- | --------------- | ----- |
| `AdminPlansPage → ParseToMonths` | cross_community | 4     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 1 calls     |
| Subscription | 1 calls     |
| Types        | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "AdminPlansPage"})` — see callers and callees
2. `gitnexus_query({query: "plans"})` — find related execution flows
3. Read key files listed above for implementation details
