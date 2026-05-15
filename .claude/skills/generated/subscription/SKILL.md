---
name: subscription
description: 'Skill for the Subscription area of rinkuzu. 28 symbols across 8 files.'
---

# Subscription

28 symbols | 8 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how POST, findAvailableOrderCode, POST work
- Modifying subscription-related functionality

## Key Files

| File                                                         | Symbols                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/subscription/SubscriptionService.ts`           | verifyAndActivateSubscription, activateVerifiedSubscription, createPaymentRequest, checkAndUpdateExpiredSubscriptions, markUserSubscriptionExpired (+2) |
| `src/services/subscription/SubscriptionPaymentService.ts`    | createPaymentRequest, isUserPremiumInternal, isExpired, generateUniqueOrderCode, findAvailableOrderCode (+1)                                            |
| `src/services/subscription/SubscriptionActivationService.ts` | verifyAndActivateSubscription, activateVerifiedSubscription, activateSubscription, SubscriptionActivationService, cancelSubscription                    |
| `src/app/[locale]/(app)/subscription/page.tsx`               | SubscriptionPage, loadInitialData, handlePurchase, formatPrice, formatDate                                                                              |
| `src/app/api/admin/subscriptions/check-expired/route.ts`     | doCheckExpired, POST                                                                                                                                    |
| `src/types/subscription.ts`                                  | calculateEndDate                                                                                                                                        |
| `src/app/api/subscription/verify/route.ts`                   | POST                                                                                                                                                    |
| `src/app/api/subscription/create-payment/route.ts`           | POST                                                                                                                                                    |

## Entry Points

Start here when exploring this area:

- **`POST`** (Function) — `src/app/api/subscription/verify/route.ts:7`
- **`findAvailableOrderCode`** (Function) — `src/services/subscription/SubscriptionPaymentService.ts:140`
- **`POST`** (Function) — `src/app/api/subscription/create-payment/route.ts:8`
- **`SubscriptionPage`** (Function) — `src/app/[locale]/(app)/subscription/page.tsx:82`
- **`loadInitialData`** (Function) — `src/app/[locale]/(app)/subscription/page.tsx:87`

## Key Symbols

| Symbol                          | Type     | File                                                         | Line |
| ------------------------------- | -------- | ------------------------------------------------------------ | ---- |
| `SubscriptionPaymentService`    | Class    | `src/services/subscription/SubscriptionPaymentService.ts`    | 8    |
| `SubscriptionActivationService` | Class    | `src/services/subscription/SubscriptionActivationService.ts` | 8    |
| `POST`                          | Function | `src/app/api/subscription/verify/route.ts`                   | 7    |
| `findAvailableOrderCode`        | Function | `src/services/subscription/SubscriptionPaymentService.ts`    | 140  |
| `POST`                          | Function | `src/app/api/subscription/create-payment/route.ts`           | 8    |
| `SubscriptionPage`              | Function | `src/app/[locale]/(app)/subscription/page.tsx`               | 82   |
| `loadInitialData`               | Function | `src/app/[locale]/(app)/subscription/page.tsx`               | 87   |
| `handlePurchase`                | Function | `src/app/[locale]/(app)/subscription/page.tsx`               | 113  |
| `formatPrice`                   | Function | `src/app/[locale]/(app)/subscription/page.tsx`               | 138  |
| `formatDate`                    | Function | `src/app/[locale]/(app)/subscription/page.tsx`               | 142  |
| `POST`                          | Function | `src/app/api/admin/subscriptions/check-expired/route.ts`     | 17   |
| `calculateEndDate`              | Method   | `src/types/subscription.ts`                                  | 86   |
| `verifyAndActivateSubscription` | Method   | `src/services/subscription/SubscriptionService.ts`           | 74   |
| `activateVerifiedSubscription`  | Method   | `src/services/subscription/SubscriptionService.ts`           | 81   |
| `verifyAndActivateSubscription` | Method   | `src/services/subscription/SubscriptionActivationService.ts` | 15   |
| `activateVerifiedSubscription`  | Method   | `src/services/subscription/SubscriptionActivationService.ts` | 74   |
| `activateSubscription`          | Method   | `src/services/subscription/SubscriptionActivationService.ts` | 157  |
| `createPaymentRequest`          | Method   | `src/services/subscription/SubscriptionService.ts`           | 70   |
| `createPaymentRequest`          | Method   | `src/services/subscription/SubscriptionPaymentService.ts`    | 15   |
| `isUserPremiumInternal`         | Method   | `src/services/subscription/SubscriptionPaymentService.ts`    | 122  |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 7     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 7     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 7     |
| `POST → ParseToMonths`               | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Quiz         | 6 calls     |
| Repositories | 4 calls     |
| Plans        | 1 calls     |
| Components   | 1 calls     |
| Categories   | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "POST"})` — see callers and callees
2. `gitnexus_query({query: "subscription"})` — find related execution flows
3. Read key files listed above for implementation details
