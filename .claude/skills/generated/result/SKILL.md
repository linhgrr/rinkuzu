---
name: result
description: 'Skill for the Result area of rinkuzu. 16 symbols across 3 files.'
---

# Result

16 symbols | 3 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how clearHistory, getHistory, QuizResultPage work
- Modifying result-related functionality

## Key Files

| File                                                 | Symbols                                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | QuizResultPage, getScoreColor, getScoreMessage, formatAnswer, formatCorrectAnswer (+6) |
| `src/lib/api/client.ts`                              | ApiResponseError, parseApiBody, fetchApiSuccess                                        |
| `src/features/quiz/hooks/useStreamingChatSession.ts` | clearHistory, getHistory                                                               |

## Entry Points

Start here when exploring this area:

- **`clearHistory`** (Function) — `src/features/quiz/hooks/useStreamingChatSession.ts:79`
- **`getHistory`** (Function) — `src/features/quiz/hooks/useStreamingChatSession.ts:96`
- **`QuizResultPage`** (Function) — `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx:50`
- **`getScoreColor`** (Function) — `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx:128`
- **`getScoreMessage`** (Function) — `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx:134`

## Key Symbols

| Symbol                     | Type     | File                                                 | Line |
| -------------------------- | -------- | ---------------------------------------------------- | ---- |
| `ApiResponseError`         | Class    | `src/lib/api/client.ts`                              | 0    |
| `clearHistory`             | Function | `src/features/quiz/hooks/useStreamingChatSession.ts` | 79   |
| `getHistory`               | Function | `src/features/quiz/hooks/useStreamingChatSession.ts` | 96   |
| `QuizResultPage`           | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 50   |
| `getScoreColor`            | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 128  |
| `getScoreMessage`          | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 134  |
| `formatAnswer`             | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 142  |
| `formatCorrectAnswer`      | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 160  |
| `clearChatHistory`         | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 213  |
| `getChatStats`             | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 323  |
| `parseApiBody`             | Function | `src/lib/api/client.ts`                              | 17   |
| `fetchApiSuccess`          | Function | `src/lib/api/client.ts`                              | 37   |
| `checkBookmarkedQuestions` | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 88   |
| `fetchResults`             | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 107  |
| `removeBookmark`           | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 218  |
| `toggleBookmark`           | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx` | 259  |

## Execution Flows

| Flow                                | Type            | Steps |
| ----------------------------------- | --------------- | ----- |
| `QuizResultPage → ParseApiBody`     | cross_community | 5     |
| `QuizResultPage → ApiResponseError` | cross_community | 5     |
| `HandleKeyPress → GetHistory`       | cross_community | 4     |
| `HandleKeyPress → GetHistory`       | cross_community | 4     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Components | 2 calls     |
| [slug]     | 1 calls     |
| Flashcards | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "clearHistory"})` — see callers and callees
2. `gitnexus_query({query: "result"})` — find related execution flows
3. Read key files listed above for implementation details
