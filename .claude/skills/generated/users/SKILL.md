---
name: users
description: 'Skill for the Users area of rinkuzu. 14 symbols across 1 files.'
---

# Users

14 symbols | 1 files | Cohesion: 93%

## When to Use

- Working with code in `src/`
- Understanding how AdminUsersPage, runUserAction, handleChangeRole work
- Modifying users-related functionality

## Key Files

| File                                          | Symbols                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/admin/users/page.tsx` | AdminUsersPage, runUserAction, handleChangeRole, handleDeleteUser, handleAddSubscription (+9) |

## Entry Points

Start here when exploring this area:

- **`AdminUsersPage`** (Function) — `src/app/[locale]/(app)/admin/users/page.tsx:661`
- **`runUserAction`** (Function) — `src/app/[locale]/(app)/admin/users/page.tsx:699`
- **`handleChangeRole`** (Function) — `src/app/[locale]/(app)/admin/users/page.tsx:729`
- **`handleDeleteUser`** (Function) — `src/app/[locale]/(app)/admin/users/page.tsx:747`
- **`handleAddSubscription`** (Function) — `src/app/[locale]/(app)/admin/users/page.tsx:760`

## Key Symbols

| Symbol                   | Type     | File                                          | Line |
| ------------------------ | -------- | --------------------------------------------- | ---- |
| `AdminUsersPage`         | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 661  |
| `runUserAction`          | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 699  |
| `handleChangeRole`       | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 729  |
| `handleDeleteUser`       | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 747  |
| `handleAddSubscription`  | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 760  |
| `getRoleBadge`           | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 153  |
| `getSubscriptionText`    | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 161  |
| `getSubscriptionBadge`   | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 168  |
| `UserRow`                | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 310  |
| `formatCurrency`         | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 149  |
| `SubscriptionPlanButton` | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 542  |
| `SelectedPlanDetails`    | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 578  |
| `formatDate`             | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 175  |
| `HydratedDateText`       | Function | `src/app/[locale]/(app)/admin/users/page.tsx` | 180  |

## Execution Flows

| Flow                                | Type            | Steps |
| ----------------------------------- | --------------- | ----- |
| `AdminUsersPage → ParseApiBody`     | cross_community | 5     |
| `AdminUsersPage → ApiResponseError` | cross_community | 5     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Categories | 3 calls     |

## How to Explore

1. `gitnexus_context({name: "AdminUsersPage"})` — see callers and callees
2. `gitnexus_query({query: "users"})` — find related execution flows
3. Read key files listed above for implementation details
