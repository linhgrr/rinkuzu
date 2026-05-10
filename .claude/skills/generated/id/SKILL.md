---
name: id
description: 'Skill for the [id] area of rinkuzu. 17 symbols across 6 files.'
---

# [id]

17 symbols | 6 files | Cohesion: 64%

## When to Use

- Working with code in `src/`
- Understanding how EditQuizPage, updateOption, updateOptionImage work
- Modifying [id]-related functionality

## Key Files

| File                                              | Symbols                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/edit/[id]/page.tsx`       | EditQuizPage, updateOption, updateOptionImage, removeOptionImage, removeQuestion (+7) |
| `src/lib/s3.ts`                                   | getSignedPDFUrl                                                                       |
| `src/services/quiz/QuizService.ts`                | getQuizById                                                                           |
| `src/app/api/quizzes/[id]/route.ts`               | GET                                                                                   |
| `src/app/api/draft/[id]/route.ts`                 | GET                                                                                   |
| `src/app/[locale]/(app)/draft/[id]/edit/page.tsx` | DraftEditPage                                                                         |

## Entry Points

Start here when exploring this area:

- **`EditQuizPage`** (Function) — `src/app/[locale]/(app)/edit/[id]/page.tsx:51`
- **`updateOption`** (Function) — `src/app/[locale]/(app)/edit/[id]/page.tsx:110`
- **`updateOptionImage`** (Function) — `src/app/[locale]/(app)/edit/[id]/page.tsx:124`
- **`removeOptionImage`** (Function) — `src/app/[locale]/(app)/edit/[id]/page.tsx:136`
- **`removeQuestion`** (Function) — `src/app/[locale]/(app)/edit/[id]/page.tsx:155`

## Key Symbols

| Symbol                  | Type     | File                                              | Line |
| ----------------------- | -------- | ------------------------------------------------- | ---- |
| `EditQuizPage`          | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 51   |
| `updateOption`          | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 110  |
| `updateOptionImage`     | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 124  |
| `removeOptionImage`     | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 136  |
| `removeQuestion`        | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 155  |
| `toggleQuestionType`    | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 158  |
| `toggleMultipleCorrect` | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 173  |
| `handleDelete`          | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 247  |
| `getSignedPDFUrl`       | Function | `src/lib/s3.ts`                                   | 106  |
| `GET`                   | Function | `src/app/api/quizzes/[id]/route.ts`               | 7    |
| `GET`                   | Function | `src/app/api/draft/[id]/route.ts`                 | 9    |
| `DraftEditPage`         | Function | `src/app/[locale]/(app)/draft/[id]/edit/page.tsx` | 13   |
| `updateQuestionField`   | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 104  |
| `updateQuestionImage`   | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 116  |
| `removeQuestionImage`   | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 120  |
| `setSingleCorrect`      | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`       | 169  |
| `getQuizById`           | Method   | `src/services/quiz/QuizService.ts`                | 218  |

## Execution Flows

| Flow                                    | Type            | Steps |
| --------------------------------------- | --------------- | ----- |
| `GET → IsExpired`                       | cross_community | 5     |
| `GET → MarkUserSubscriptionExpired`     | cross_community | 5     |
| `GET → SubscriptionRepository`          | cross_community | 4     |
| `GET → UserRepository`                  | cross_community | 4     |
| `GET → PayOSService`                    | cross_community | 4     |
| `GET → SubscriptionService`             | cross_community | 4     |
| `EditQuizPage → ReadRequiredRouteParam` | cross_community | 3     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Quiz         | 2 calls     |
| Subscription | 2 calls     |
| Repositories | 2 calls     |
| [slug]       | 1 calls     |
| Flashcards   | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "EditQuizPage"})` — see callers and callees
2. `gitnexus_query({query: "[id]"})` — find related execution flows
3. Read key files listed above for implementation details
