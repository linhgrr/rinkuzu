---
name: quiz
description: 'Skill for the Quiz area of rinkuzu. 109 symbols across 51 files.'
---

# Quiz

109 symbols | 51 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how deletePDF, hashPassword, apiOk work
- Modifying quiz-related functionality

## Key Files

| File                                                    | Symbols                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/services/quiz/QuizService.ts`                      | updateQuiz, deleteQuiz, approveQuiz, rejectQuiz, reportQuiz (+11)                           |
| `src/services/quiz/QuizPlayService.ts`                  | getQuizForFlashcards, getQuizForPlay, getQuizFlashcards, submitQuizAttempt, QuizPlayService |
| `src/services/quiz/QuizCrudService.ts`                  | updateQuiz, deleteQuiz, getQuizById, QuizCrudService, createQuiz                            |
| `src/app/api/adaptive-learning/library-images/route.ts` | toPositiveInt, extractImageUrl, collectImageUrls, normalizePayload, GET                     |
| `src/services/quiz/QuizDiscussionService.ts`            | reportQuiz, getQuizDiscussions, addDiscussionComment, QuizDiscussionService                 |
| `src/services/quiz/QuizAdminService.ts`                 | approveQuiz, rejectQuiz, QuizAdminService, previewFromPdf                                   |
| `src/app/api/user/avatar/route.ts`                      | getExtension, extractS3Key, PUT, DELETE                                                     |
| `src/services/subscription/SubscriptionService.ts`      | SubscriptionService, getUserSubscription, isUserPremium, isExpired                          |
| `src/services/bookmark/BookmarkService.ts`              | getBookmarksByUser, createBookmark, deleteBookmarkByUser                                    |
| `src/app/api/subscription/webhook/route.ts`             | buildPayOSSignaturePayload, isValidSignature, POST                                          |

## Entry Points

Start here when exploring this area:

- **`deletePDF`** (Function) — `src/lib/s3.ts:59`
- **`hashPassword`** (Function) — `src/lib/password.ts:3`
- **`apiOk`** (Function) — `src/lib/api/response.ts:3`
- **`apiErr`** (Function) — `src/lib/api/response.ts:7`
- **`withAdmin`** (Function) — `src/lib/api/auth.ts:72`

## Key Symbols

| Symbol                  | Type     | File                                               | Line |
| ----------------------- | -------- | -------------------------------------------------- | ---- |
| `SubscriptionService`   | Class    | `src/services/subscription/SubscriptionService.ts` | 16   |
| `PayOSService`          | Class    | `src/services/payment/PayOSService.ts`             | 8    |
| `QuizPlayService`       | Class    | `src/services/quiz/QuizPlayService.ts`             | 10   |
| `QuizDiscussionService` | Class    | `src/services/quiz/QuizDiscussionService.ts`       | 7    |
| `QuizCrudService`       | Class    | `src/services/quiz/QuizCrudService.ts`             | 11   |
| `QuizAdminService`      | Class    | `src/services/quiz/QuizAdminService.ts`            | 6    |
| `QuizService`           | Class    | `src/services/quiz/QuizService.ts`                 | 19   |
| `deletePDF`             | Function | `src/lib/s3.ts`                                    | 59   |
| `hashPassword`          | Function | `src/lib/password.ts`                              | 3    |
| `apiOk`                 | Function | `src/lib/api/response.ts`                          | 3    |
| `apiErr`                | Function | `src/lib/api/response.ts`                          | 7    |
| `withAdmin`             | Function | `src/lib/api/auth.ts`                              | 72   |
| `GET`                   | Function | `src/app/api/bookmarks/route.ts`                   | 9    |
| `POST`                  | Function | `src/app/api/bookmarks/route.ts`                   | 33   |
| `PUT`                   | Function | `src/app/api/user/password/route.ts`               | 8    |
| `PUT`                   | Function | `src/app/api/user/avatar/route.ts`                 | 34   |
| `DELETE`                | Function | `src/app/api/user/avatar/route.ts`                 | 149  |
| `GET`                   | Function | `src/app/api/user/attempts/route.ts`               | 10   |
| `POST`                  | Function | `src/app/api/subscription/webhook/route.ts`        | 26   |
| `POST`                  | Function | `src/app/api/review/submit/route.ts`               | 8    |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `GET → IsExpired`                    | cross_community | 7     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 7     |
| `POST → IsExpired`                   | cross_community | 7     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 7     |
| `POST → IsExpired`                   | cross_community | 7     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 7     |
| `GET → IsExpired`                    | intra_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → IsExpired`                    | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |

## Connected Areas

| Area          | Connections |
| ------------- | ----------- |
| Repositories  | 13 calls    |
| Components    | 3 calls     |
| Subscription  | 2 calls     |
| Hooks         | 2 calls     |
| Admin         | 2 calls     |
| Ai            | 1 calls     |
| Process-chunk | 1 calls     |
| Auth          | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "deletePDF"})` — see callers and callees
2. `gitnexus_query({query: "quiz"})` — find related execution flows
3. Read key files listed above for implementation details
