---
name: quiz
description: 'Skill for the Quiz area of rinkuzu. 29 symbols across 14 files.'
---

# Quiz

29 symbols | 14 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how PUT, DELETE, POST work
- Modifying quiz-related functionality

## Key Files

| File                                                                      | Symbols                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/services/quiz/QuizService.ts`                                        | QuizService, getQuizBySlug, updateQuiz, deleteQuiz, approveQuiz (+9) |
| `src/app/api/quizzes/[id]/route.ts`                                       | PUT, DELETE                                                          |
| `src/app/api/quiz/[slug]/discussions/route.ts`                            | GET, POST                                                            |
| `src/lib/serviceFactory.ts`                                               | getQuizService                                                       |
| `src/interfaces/services/IQuizService.ts`                                 | IQuizService                                                         |
| `tests/integration/services/quiz/QuizService.subscription-access.test.ts` | createQuizService                                                    |
| `src/app/api/quizzes/[id]/reject/route.ts`                                | POST                                                                 |
| `src/app/api/quizzes/[id]/approve/route.ts`                               | POST                                                                 |
| `src/app/api/quiz/[slug]/report/route.ts`                                 | POST                                                                 |
| `src/app/[locale]/(app)/quiz/[slug]/layout.tsx`                           | generateMetadata                                                     |

## Entry Points

Start here when exploring this area:

- **`PUT`** (Function) — `src/app/api/quizzes/[id]/route.ts:66`
- **`DELETE`** (Function) — `src/app/api/quizzes/[id]/route.ts:109`
- **`POST`** (Function) — `src/app/api/quizzes/[id]/reject/route.ts:6`
- **`POST`** (Function) — `src/app/api/quizzes/[id]/approve/route.ts:6`
- **`POST`** (Function) — `src/app/api/quiz/[slug]/report/route.ts:6`

## Key Symbols

| Symbol             | Type      | File                                            | Line |
| ------------------ | --------- | ----------------------------------------------- | ---- |
| `QuizService`      | Class     | `src/services/quiz/QuizService.ts`              | 24   |
| `PUT`              | Function  | `src/app/api/quizzes/[id]/route.ts`             | 66   |
| `DELETE`           | Function  | `src/app/api/quizzes/[id]/route.ts`             | 109  |
| `POST`             | Function  | `src/app/api/quizzes/[id]/reject/route.ts`      | 6    |
| `POST`             | Function  | `src/app/api/quizzes/[id]/approve/route.ts`     | 6    |
| `POST`             | Function  | `src/app/api/quiz/[slug]/report/route.ts`       | 6    |
| `generateMetadata` | Function  | `src/app/[locale]/(app)/quiz/[slug]/layout.tsx` | 9    |
| `GET`              | Function  | `src/app/api/quiz/[slug]/play/route.ts`         | 8    |
| `GET`              | Function  | `src/app/api/quiz/[slug]/discussions/route.ts`  | 7    |
| `POST`             | Function  | `src/app/api/quiz/[slug]/discussions/route.ts`  | 36   |
| `POST`             | Function  | `src/app/api/quiz/[slug]/attempt/route.ts`      | 6    |
| `generateSlug`     | Function  | `src/lib/utils.ts`                              | 7    |
| `POST`             | Function  | `src/app/api/quizzes/route.ts`                  | 48   |
| `IQuizService`     | Interface | `src/interfaces/services/IQuizService.ts`       | 31   |
| `getQuizService`   | Method    | `src/lib/serviceFactory.ts`                     | 58   |
| `getQuizBySlug`    | Method    | `src/services/quiz/QuizService.ts`              | 287  |
| `updateQuiz`       | Method    | `src/services/quiz/QuizService.ts`              | 380  |
| `deleteQuiz`       | Method    | `src/services/quiz/QuizService.ts`              | 427  |
| `approveQuiz`      | Method    | `src/services/quiz/QuizService.ts`              | 473  |
| `rejectQuiz`       | Method    | `src/services/quiz/QuizService.ts`              | 491  |

## Execution Flows

| Flow                                  | Type            | Steps |
| ------------------------------------- | --------------- | ----- |
| `GET → IsExpired`                     | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`   | cross_community | 6     |
| `POST → IsExpired`                    | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `POST → IsExpired`                    | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GenerateMetadata → NormalizeSeoPath` | cross_community | 6     |
| `GenerateMetadata → LocalePrefix`     | cross_community | 6     |
| `GET → SubscriptionRepository`        | cross_community | 5     |
| `GET → UserRepository`                | cross_community | 5     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Subscription | 4 calls     |
| Repositories | 1 calls     |
| [slug]       | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "PUT"})` — see callers and callees
2. `gitnexus_query({query: "quiz"})` — find related execution flows
3. Read key files listed above for implementation details
