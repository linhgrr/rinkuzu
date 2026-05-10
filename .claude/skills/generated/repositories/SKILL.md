---
name: repositories
description: 'Skill for the Repositories area of rinkuzu. 112 symbols across 31 files.'
---

# Repositories

112 symbols | 31 files | Cohesion: 100%

## When to Use

- Working with code in `src/`
- Understanding how deletePDF, POST, GET work
- Modifying repositories-related functionality

## Key Files

| File                                         | Symbols                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/repositories/QuizRepository.ts`         | findById, findBySlug, findBySlugAndStatus, create, update (+10)                |
| `src/repositories/CategoryRepository.ts`     | normalizeSlug, findById, findBySlug, findAll, findActive (+8)                  |
| `src/repositories/AttemptRepository.ts`      | findById, findByUser, findByUserId, create, countByUser (+7)                   |
| `src/repositories/UserRepository.ts`         | findByEmail, findById, create, update, delete (+6)                             |
| `src/repositories/SubscriptionRepository.ts` | create, findById, findByOrderId, findByUser, findExpiredSubscriptions (+5)     |
| `src/repositories/ReportRepository.ts`       | findById, findAll, create, update, delete (+2)                                 |
| `src/repositories/DiscussionRepository.ts`   | findById, findByQuiz, create, update, delete (+2)                              |
| `src/repositories/BookmarkRepository.ts`     | findByUserEmail, findByUserAndQuiz, create, deleteById, deleteByIdAndUser (+2) |
| `src/app/api/draft/[id]/submit/route.ts`     | generateSlug, validateQuestions, POST                                          |
| `src/app/api/admin/categories/[id]/route.ts` | GET, PUT, DELETE                                                               |

## Entry Points

Start here when exploring this area:

- **`deletePDF`** (Function) — `src/lib/s3.ts:121`
- **`POST`** (Function) — `src/app/api/subscription/create-payment/route.ts:7`
- **`GET`** (Function) — `src/app/api/user/profile/route.ts:8`
- **`PUT`** (Function) — `src/app/api/user/profile/route.ts:46`
- **`POST`** (Function) — `src/app/api/shop/buy-freeze/route.ts:6`

## Key Symbols

| Symbol                 | Type     | File                                               | Line |
| ---------------------- | -------- | -------------------------------------------------- | ---- |
| `UserRepository`       | Class    | `src/repositories/UserRepository.ts`               | 5    |
| `ReportRepository`     | Class    | `src/repositories/ReportRepository.ts`             | 4    |
| `QuizRepository`       | Class    | `src/repositories/QuizRepository.ts`               | 5    |
| `DiscussionRepository` | Class    | `src/repositories/DiscussionRepository.ts`         | 7    |
| `CategoryRepository`   | Class    | `src/repositories/CategoryRepository.ts`           | 11   |
| `BookmarkRepository`   | Class    | `src/repositories/BookmarkRepository.ts`           | 4    |
| `AttemptRepository`    | Class    | `src/repositories/AttemptRepository.ts`            | 4    |
| `deletePDF`            | Function | `src/lib/s3.ts`                                    | 121  |
| `POST`                 | Function | `src/app/api/subscription/create-payment/route.ts` | 7    |
| `GET`                  | Function | `src/app/api/user/profile/route.ts`                | 8    |
| `PUT`                  | Function | `src/app/api/user/profile/route.ts`                | 46   |
| `POST`                 | Function | `src/app/api/shop/buy-freeze/route.ts`             | 6    |
| `POST`                 | Function | `src/app/api/review/submit/route.ts`               | 8    |
| `GET`                  | Function | `src/app/api/review/due/route.ts`                  | 8    |
| `GET`                  | Function | `src/app/api/draft/list/route.ts`                  | 9    |
| `POST`                 | Function | `src/app/api/draft/create/route.ts`                | 11   |
| `DELETE`               | Function | `src/app/api/draft/[id]/route.ts`                  | 46   |
| `POST`                 | Function | `src/app/api/admin/users/route.ts`                 | 124  |
| `GET`                  | Function | `src/app/api/admin/plans/route.ts`                 | 7    |
| `DELETE`               | Function | `src/app/api/admin/plans/route.ts`                 | 157  |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `POST → IsExpired`                   | cross_community | 5     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 5     |
| `GET → UserRepository`               | cross_community | 5     |
| `POST → UserRepository`              | cross_community | 5     |
| `POST → UserRepository`              | cross_community | 5     |
| `POST → UserRepository`              | cross_community | 5     |
| `POST → UserRepository`              | cross_community | 5     |
| `GET → UserRepository`               | cross_community | 5     |
| `GET → UserRepository`               | cross_community | 5     |
| `GET → UserRepository`               | cross_community | 5     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Subscription | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "deletePDF"})` — see callers and callees
2. `gitnexus_query({query: "repositories"})` — find related execution flows
3. Read key files listed above for implementation details
