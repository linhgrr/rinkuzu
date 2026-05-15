---
name: result
description: 'Skill for the Result area of rinkuzu. 18 symbols across 7 files.'
---

# Result

18 symbols | 7 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how useRequiredRouteParam, readRequiredRouteParam, routePathSegment work
- Modifying result-related functionality

## Key Files

| File                                                     | Symbols                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | formatAnswerValue, isQuestionAnswered, buildQuizResultStats, getQuizResultScoreMessage, useQuizResultPageData (+1) |
| `src/app/[locale]/(app)/history/[attemptId]/page.tsx`    | formatAttemptDate, AttemptDetailPage, fetchAttemptDetail                                                           |
| `src/app/[locale]/(app)/edit/[id]/page.tsx`              | EditQuizPage, fetchQuiz, handleDelete                                                                              |
| `src/lib/routing/routeParams.ts`                         | readRequiredRouteParam, routePathSegment                                                                           |
| `src/app/[locale]/(app)/quiz/[slug]/flashcards/page.tsx` | FlashcardPage, loadQuiz                                                                                            |
| `src/lib/routing/useRequiredRouteParam.ts`               | useRequiredRouteParam                                                                                              |
| `src/app/[locale]/(app)/category/[slug]/page.tsx`        | CategoryPage                                                                                                       |

## Entry Points

Start here when exploring this area:

- **`useRequiredRouteParam`** (Function) — `src/lib/routing/useRequiredRouteParam.ts:5`
- **`readRequiredRouteParam`** (Function) — `src/lib/routing/routeParams.ts:3`
- **`routePathSegment`** (Function) — `src/lib/routing/routeParams.ts:14`
- **`AttemptDetailPage`** (Function) — `src/app/[locale]/(app)/history/[attemptId]/page.tsx:357`
- **`fetchAttemptDetail`** (Function) — `src/app/[locale]/(app)/history/[attemptId]/page.tsx:371`

## Key Symbols

| Symbol                      | Type     | File                                                     | Line |
| --------------------------- | -------- | -------------------------------------------------------- | ---- |
| `useRequiredRouteParam`     | Function | `src/lib/routing/useRequiredRouteParam.ts`               | 5    |
| `readRequiredRouteParam`    | Function | `src/lib/routing/routeParams.ts`                         | 3    |
| `routePathSegment`          | Function | `src/lib/routing/routeParams.ts`                         | 14   |
| `AttemptDetailPage`         | Function | `src/app/[locale]/(app)/history/[attemptId]/page.tsx`    | 357  |
| `fetchAttemptDetail`        | Function | `src/app/[locale]/(app)/history/[attemptId]/page.tsx`    | 371  |
| `EditQuizPage`              | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`              | 603  |
| `fetchQuiz`                 | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`              | 611  |
| `handleDelete`              | Function | `src/app/[locale]/(app)/edit/[id]/page.tsx`              | 697  |
| `CategoryPage`              | Function | `src/app/[locale]/(app)/category/[slug]/page.tsx`        | 441  |
| `FlashcardPage`             | Function | `src/app/[locale]/(app)/quiz/[slug]/flashcards/page.tsx` | 423  |
| `loadQuiz`                  | Function | `src/app/[locale]/(app)/quiz/[slug]/flashcards/page.tsx` | 432  |
| `formatAttemptDate`         | Function | `src/app/[locale]/(app)/history/[attemptId]/page.tsx`    | 84   |
| `formatAnswerValue`         | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 206  |
| `isQuestionAnswered`        | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 374  |
| `buildQuizResultStats`      | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 380  |
| `getQuizResultScoreMessage` | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 412  |
| `useQuizResultPageData`     | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 420  |
| `QuizResultPageClient`      | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`     | 781  |

## Execution Flows

| Flow                                                | Type            | Steps |
| --------------------------------------------------- | --------------- | ----- |
| `QuizResultPageClient → ParseApiBody`               | cross_community | 7     |
| `QuizResultPageClient → ApiResponseError`           | cross_community | 7     |
| `EditQuizPage → ParseApiBody`                       | cross_community | 5     |
| `EditQuizPage → ApiResponseError`                   | cross_community | 5     |
| `AttemptDetailPage → ParseApiBody`                  | cross_community | 5     |
| `AttemptDetailPage → ApiResponseError`              | cross_community | 5     |
| `FlashcardPage → ParseApiBody`                      | cross_community | 5     |
| `FlashcardPage → ApiResponseError`                  | cross_community | 5     |
| `QuizResultPageClient → ExtractUnknownErrorMessage` | cross_community | 4     |
| `QuizResultPageClient → IsQuestionAnswered`         | intra_community | 4     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Categories | 5 calls     |
| Components | 3 calls     |
| Ui         | 1 calls     |
| Quiz       | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "useRequiredRouteParam"})` — see callers and callees
2. `gitnexus_query({query: "result"})` — find related execution flows
3. Read key files listed above for implementation details
