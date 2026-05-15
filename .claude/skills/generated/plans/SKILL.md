---
name: plans
description: 'Skill for the Plans area of rinkuzu. 24 symbols across 4 files.'
---

# Plans

24 symbols | 4 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how GET, parseToMonths, getDurationInfo work
- Modifying plans-related functionality

## Key Files

| File                                               | Symbols                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/admin/plans/page.tsx`      | createEditFormState, formatCurrency, getDurationDisplay, PlanCard, createFeatureField (+12) |
| `src/types/subscription.ts`                        | parseToMonths, getDurationInfo, isValidISO8601Duration                                      |
| `src/app/api/subscription/plans/route.ts`          | GET, formatDurationDisplay, parseDurationToMonths                                           |
| `src/services/subscription/SubscriptionService.ts` | getSubscriptionPlans                                                                        |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/subscription/plans/route.ts:3`
- **`parseToMonths`** (Method) — `src/types/subscription.ts:63`
- **`getDurationInfo`** (Method) — `src/types/subscription.ts:100`
- **`isValidISO8601Duration`** (Method) — `src/types/subscription.ts:137`
- **`getSubscriptionPlans`** (Method) — `src/services/subscription/SubscriptionService.ts:138`

## Key Symbols

| Symbol                   | Type     | File                                               | Line |
| ------------------------ | -------- | -------------------------------------------------- | ---- |
| `GET`                    | Function | `src/app/api/subscription/plans/route.ts`          | 3    |
| `parseToMonths`          | Method   | `src/types/subscription.ts`                        | 63   |
| `getDurationInfo`        | Method   | `src/types/subscription.ts`                        | 100  |
| `isValidISO8601Duration` | Method   | `src/types/subscription.ts`                        | 137  |
| `getSubscriptionPlans`   | Method   | `src/services/subscription/SubscriptionService.ts` | 138  |
| `createEditFormState`    | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 85   |
| `formatCurrency`         | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 119  |
| `getDurationDisplay`     | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 123  |
| `PlanCard`               | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 395  |
| `createFeatureField`     | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 66   |
| `createPlanFormState`    | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 75   |
| `resetForm`              | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 162  |
| `handleAddFeature`       | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 184  |
| `handleRemoveFeature`    | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 191  |
| `handleStartEdit`        | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 425  |
| `handleCancelEdit`       | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 430  |
| `formatDurationDisplay`  | Function | `src/app/api/subscription/plans/route.ts`          | 31   |
| `parseDurationToMonths`  | Function | `src/app/api/subscription/plans/route.ts`          | 44   |
| `serializeFeatureFields` | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 97   |
| `handleClose`            | Function | `src/app/[locale]/(app)/admin/plans/page.tsx`      | 170  |

## Execution Flows

| Flow                       | Type            | Steps |
| -------------------------- | --------------- | ----- |
| `POST → ParseToMonths`     | cross_community | 6     |
| `HandleSubmit → Random`    | cross_community | 6     |
| `PlanCard → Random`        | cross_community | 4     |
| `PlanCard → ParseToMonths` | intra_community | 4     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Quiz         | 3 calls     |
| Repositories | 1 calls     |
| Ui           | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "plans"})` — find related execution flows
3. Read key files listed above for implementation details
