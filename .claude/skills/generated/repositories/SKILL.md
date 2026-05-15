---
name: repositories
description: 'Skill for the Repositories area of rinkuzu. 80 symbols across 25 files.'
---

# Repositories

80 symbols | 25 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how getSignedPDFUrl, GET, PUT work
- Modifying repositories-related functionality

## Key Files

| File                                         | Symbols                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/repositories/QuizRepository.ts`         | findById, findBySlug, findBySlugAndStatus, update, findForPlay (+7)                     |
| `src/repositories/SubscriptionRepository.ts` | findByOrderId, findByUser, findExpiredSubscriptions, updateById, updateByOrderId (+4)   |
| `src/repositories/CategoryRepository.ts`     | normalizeSlug, findBySlug, findActive, search, findWithQuizCount (+3)                   |
| `src/repositories/AttemptRepository.ts`      | findById, findByUserId, countByUser, countByQuiz, findRecentActivity (+3)               |
| `src/repositories/base.ts`                   | findById, create, update, delete, count (+1)                                            |
| `src/repositories/UserRepository.ts`         | findByEmail, countByRole, findExpiredSubscriptionUsers, updateById, UserRepository (+1) |
| `src/repositories/DiscussionRepository.ts`   | findById, findByQuiz, create, update, DiscussionRepository                              |
| `src/repositories/BookmarkRepository.ts`     | findByUserAndQuiz, deleteById, deleteByIdAndUser, BookmarkRepository, findByUserEmail   |
| `src/repositories/ReportRepository.ts`       | findById, update, ReportRepository, findAll                                             |
| `src/app/api/user/profile/route.ts`          | GET, PUT                                                                                |

## Entry Points

Start here when exploring this area:

- **`getSignedPDFUrl`** (Function) — `src/lib/s3.ts:44`
- **`GET`** (Function) — `src/app/api/user/profile/route.ts:9`
- **`PUT`** (Function) — `src/app/api/user/profile/route.ts:44`
- **`POST`** (Function) — `src/app/api/shop/buy-freeze/route.ts:7`
- **`GET`** (Function) — `src/app/api/draft/[id]/route.ts:53`

## Key Symbols

| Symbol                    | Type      | File                                                     | Line |
| ------------------------- | --------- | -------------------------------------------------------- | ---- |
| `BaseRepository`          | Class     | `src/repositories/base.ts`                               | 3    |
| `UserRepository`          | Class     | `src/repositories/UserRepository.ts`                     | 7    |
| `SubscriptionRepository`  | Class     | `src/repositories/SubscriptionRepository.ts`             | 7    |
| `ReportRepository`        | Class     | `src/repositories/ReportRepository.ts`                   | 6    |
| `QuizRepository`          | Class     | `src/repositories/QuizRepository.ts`                     | 7    |
| `DiscussionRepository`    | Class     | `src/repositories/DiscussionRepository.ts`               | 8    |
| `CategoryRepository`      | Class     | `src/repositories/CategoryRepository.ts`                 | 13   |
| `BookmarkRepository`      | Class     | `src/repositories/BookmarkRepository.ts`                 | 6    |
| `AttemptRepository`       | Class     | `src/repositories/AttemptRepository.ts`                  | 6    |
| `getSignedPDFUrl`         | Function  | `src/lib/s3.ts`                                          | 44   |
| `GET`                     | Function  | `src/app/api/user/profile/route.ts`                      | 9    |
| `PUT`                     | Function  | `src/app/api/user/profile/route.ts`                      | 44   |
| `POST`                    | Function  | `src/app/api/shop/buy-freeze/route.ts`                   | 7    |
| `GET`                     | Function  | `src/app/api/draft/[id]/route.ts`                        | 53   |
| `DraftEditPage`           | Function  | `src/app/[locale]/(app)/draft/[id]/edit/page.tsx`        | 55   |
| `buildPaginationMeta`     | Function  | `src/repositories/pagination.ts`                         | 5    |
| `IUserRepository`         | Interface | `src/interfaces/repositories/IUserRepository.ts`         | 2    |
| `ISubscriptionRepository` | Interface | `src/interfaces/repositories/ISubscriptionRepository.ts` | 3    |
| `IReportRepository`       | Interface | `src/interfaces/repositories/IReportRepository.ts`       | 11   |
| `IQuizRepository`         | Interface | `src/interfaces/repositories/IQuizRepository.ts`         | 20   |

## Execution Flows

| Flow                            | Type            | Steps |
| ------------------------------- | --------------- | ----- |
| `GET → SubscriptionRepository`  | cross_community | 6     |
| `GET → UserRepository`          | cross_community | 6     |
| `POST → SubscriptionRepository` | cross_community | 6     |
| `POST → UserRepository`         | cross_community | 6     |
| `POST → SubscriptionRepository` | cross_community | 6     |
| `POST → UserRepository`         | cross_community | 6     |
| `GET → SubscriptionRepository`  | cross_community | 5     |
| `GET → UserRepository`          | cross_community | 5     |
| `GET → SubscriptionRepository`  | cross_community | 5     |
| `GET → UserRepository`          | cross_community | 5     |

## Connected Areas

| Area | Connections |
| ---- | ----------- |
| Quiz | 5 calls     |

## How to Explore

1. `gitnexus_context({name: "getSignedPDFUrl"})` — see callers and callees
2. `gitnexus_query({query: "repositories"})` — find related execution flows
3. Read key files listed above for implementation details
