---
name: subscription
description: 'Skill for the Subscription area of rinkuzu. 33 symbols across 15 files.'
---

# Subscription

33 symbols | 15 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how GET, GET, PATCH work
- Modifying subscription-related functionality

## Key Files

| File                                                     | Symbols                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/services/subscription/SubscriptionService.ts`       | SubscriptionService, getSubscriptionHistory, updateSubscriptionById, getUserSubscription, isUserPremium (+6) |
| `src/app/[locale]/(app)/subscription/page.tsx`           | SubscriptionPage, loadInitialData, handlePurchase, formatPrice, formatDate                                   |
| `src/app/api/subscription/webhook/route.ts`              | buildPayOSSignaturePayload, isValidSignature, POST                                                           |
| `src/app/api/admin/subscriptions/[id]/route.ts`          | GET, PATCH                                                                                                   |
| `src/services/quiz/QuizService.ts`                       | getQuizFlashcards, getQuizForFlashcards                                                                      |
| `src/repositories/SubscriptionRepository.ts`             | SubscriptionRepository                                                                                       |
| `src/lib/serviceFactory.ts`                              | createSubscriptionService                                                                                    |
| `src/services/subscription/SubscriptionService.test.ts`  | createService                                                                                                |
| `src/interfaces/services/ISubscriptionService.ts`        | ISubscriptionService                                                                                         |
| `src/interfaces/repositories/ISubscriptionRepository.ts` | ISubscriptionRepository                                                                                      |

## Entry Points

Start here when exploring this area:

- **`GET`** (Function) — `src/app/api/admin/subscriptions/route.ts:7`
- **`GET`** (Function) — `src/app/api/admin/subscriptions/[id]/route.ts:8`
- **`PATCH`** (Function) — `src/app/api/admin/subscriptions/[id]/route.ts:36`
- **`GET`** (Function) — `src/app/api/subscription/status/route.ts:7`
- **`GET`** (Function) — `src/app/api/quiz/[slug]/flashcards/route.ts:6`

## Key Symbols

| Symbol                      | Type      | File                                                     | Line |
| --------------------------- | --------- | -------------------------------------------------------- | ---- |
| `SubscriptionRepository`    | Class     | `src/repositories/SubscriptionRepository.ts`             | 5    |
| `SubscriptionService`       | Class     | `src/services/subscription/SubscriptionService.ts`       | 14   |
| `GET`                       | Function  | `src/app/api/admin/subscriptions/route.ts`               | 7    |
| `GET`                       | Function  | `src/app/api/admin/subscriptions/[id]/route.ts`          | 8    |
| `PATCH`                     | Function  | `src/app/api/admin/subscriptions/[id]/route.ts`          | 36   |
| `GET`                       | Function  | `src/app/api/subscription/status/route.ts`               | 7    |
| `GET`                       | Function  | `src/app/api/quiz/[slug]/flashcards/route.ts`            | 6    |
| `POST`                      | Function  | `src/app/api/admin/subscriptions/check-expired/route.ts` | 5    |
| `POST`                      | Function  | `src/app/api/subscription/webhook/route.ts`              | 25   |
| `POST`                      | Function  | `src/app/api/subscription/verify/route.ts`               | 5    |
| `SubscriptionPage`          | Function  | `src/app/[locale]/(app)/subscription/page.tsx`           | 31   |
| `loadInitialData`           | Function  | `src/app/[locale]/(app)/subscription/page.tsx`           | 65   |
| `handlePurchase`            | Function  | `src/app/[locale]/(app)/subscription/page.tsx`           | 77   |
| `formatPrice`               | Function  | `src/app/[locale]/(app)/subscription/page.tsx`           | 111  |
| `formatDate`                | Function  | `src/app/[locale]/(app)/subscription/page.tsx`           | 118  |
| `ISubscriptionService`      | Interface | `src/interfaces/services/ISubscriptionService.ts`        | 26   |
| `ISubscriptionRepository`   | Interface | `src/interfaces/repositories/ISubscriptionRepository.ts` | 2    |
| `createSubscriptionService` | Method    | `src/lib/serviceFactory.ts`                              | 133  |
| `getSubscriptionHistory`    | Method    | `src/services/subscription/SubscriptionService.ts`       | 331  |
| `updateSubscriptionById`    | Method    | `src/services/subscription/SubscriptionService.ts`       | 418  |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `GET → IsExpired`                    | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 3 calls     |
| Payment      | 1 calls     |
| Types        | 1 calls     |
| Quiz         | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "GET"})` — see callers and callees
2. `gitnexus_query({query: "subscription"})` — find related execution flows
3. Read key files listed above for implementation details
