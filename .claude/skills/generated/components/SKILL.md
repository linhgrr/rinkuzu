---
name: components
description: 'Skill for the Components area of rinkuzu. 70 symbols across 26 files.'
---

# Components

70 symbols | 26 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how useCategorySearch, useDropdownOutside, CategorySelector work
- Modifying components-related functionality

## Key Files

| File                                                      | Symbols                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/features/categories/components/CategorySearch.tsx`   | CategorySearch, fetchCategories, loadRecentCategories, saveRecentCategory, handleCategorySelect (+1) |
| `src/features/profile/components/ProfileBookmarks.tsx`    | ProfileBookmarks, removeBookmark, formatCorrectAnswer, openAIModal, askAI (+1)                       |
| `src/features/quiz/components/Flashcard.tsx`              | Flashcard, getCorrectAnswers, getCorrectAnswerText, getCorrectAnswerLetters, getTransform (+1)       |
| `src/features/profile/components/ProfileQuizzes.tsx`      | ProfileQuizzes, getStatusColor, getStatusIcon, openPreviewModal, openDeleteConfirm (+1)              |
| `src/features/categories/components/CategorySelector.tsx` | CategorySelector, searchCategories, handleCategorySelect, handleInputFocus                           |
| `src/features/quiz/hooks/useStreamingChatSession.ts`      | useStreamingChatSession, ensureHistory, removeHistory, sendMessage                                   |
| `src/components/PWAInstaller.tsx`                         | prompt, handleInstallClick, PWAInstaller, shouldShowBanner                                           |
| `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`      | openAIModal, askAI, handleKeyPress                                                                   |
| `src/features/profile/components/ProfileHistory.tsx`      | ProfileHistory, getScoreColor, getPerformanceBadge                                                   |
| `src/features/quiz/components/QuestionDiscussion.tsx`     | QuestionDiscussion, fetchComments, formatDate                                                        |

## Entry Points

Start here when exploring this area:

- **`useCategorySearch`** (Function) — `src/features/categories/hooks/useCategorySearch.ts:9`
- **`useDropdownOutside`** (Function) — `src/components/ui/hooks/use-dropdown-outside.ts:5`
- **`CategorySelector`** (Function) — `src/features/categories/components/CategorySelector.tsx:22`
- **`searchCategories`** (Function) — `src/features/categories/components/CategorySelector.tsx:48`
- **`handleCategorySelect`** (Function) — `src/features/categories/components/CategorySelector.tsx:86`

## Key Symbols

| Symbol                    | Type     | File                                                                  | Line |
| ------------------------- | -------- | --------------------------------------------------------------------- | ---- |
| `useCategorySearch`       | Function | `src/features/categories/hooks/useCategorySearch.ts`                  | 9    |
| `useDropdownOutside`      | Function | `src/components/ui/hooks/use-dropdown-outside.ts`                     | 5    |
| `CategorySelector`        | Function | `src/features/categories/components/CategorySelector.tsx`             | 22   |
| `searchCategories`        | Function | `src/features/categories/components/CategorySelector.tsx`             | 48   |
| `handleCategorySelect`    | Function | `src/features/categories/components/CategorySelector.tsx`             | 86   |
| `handleInputFocus`        | Function | `src/features/categories/components/CategorySelector.tsx`             | 94   |
| `CategorySearch`          | Function | `src/features/categories/components/CategorySearch.tsx`               | 24   |
| `fetchCategories`         | Function | `src/features/categories/components/CategorySearch.tsx`               | 65   |
| `loadRecentCategories`    | Function | `src/features/categories/components/CategorySearch.tsx`               | 81   |
| `useStreamingChatSession` | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`                  | 31   |
| `ensureHistory`           | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`                  | 69   |
| `removeHistory`           | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`                  | 84   |
| `ProfileBookmarks`        | Function | `src/features/profile/components/ProfileBookmarks.tsx`                | 50   |
| `removeBookmark`          | Function | `src/features/profile/components/ProfileBookmarks.tsx`                | 104  |
| `formatCorrectAnswer`     | Function | `src/features/profile/components/ProfileBookmarks.tsx`                | 120  |
| `openAIModal`             | Function | `src/features/profile/components/ProfileBookmarks.tsx`                | 130  |
| `openAIModal`             | Function | `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`                  | 170  |
| `buildFaqSchema`          | Function | `src/lib/structured-data.ts`                                          | 76   |
| `AdaptiveLearningGuest`   | Function | `src/features/adaptive-learning/components/AdaptiveLearningGuest.tsx` | 17   |
| `PricingPage`             | Function | `src/app/[locale]/(marketing)/pricing/page.tsx`                       | 40   |

## Execution Flows

| Flow                                         | Type            | Steps |
| -------------------------------------------- | --------------- | ----- |
| `HandleKeyPress → CreateStreamError`         | cross_community | 7     |
| `HandleKeyPress → ExtractOpenAIDeltaContent` | cross_community | 7     |
| `HandleKeyPress → IsTerminalOpenAIEvent`     | cross_community | 7     |
| `HandleKeyPress → CreateStreamError`         | cross_community | 7     |
| `HandleKeyPress → ExtractOpenAIDeltaContent` | cross_community | 7     |
| `HandleKeyPress → IsTerminalOpenAIEvent`     | cross_community | 7     |
| `HandleKeyPress → ParseJsonResponse`         | cross_community | 6     |
| `HandleKeyPress → SplitSseEvents`            | cross_community | 6     |
| `DashboardPageShell → ResolveLocale`         | cross_community | 6     |
| `HandleKeyPress → ParseJsonResponse`         | cross_community | 6     |

## Connected Areas

| Area   | Connections |
| ------ | ----------- |
| Result | 7 calls     |
| I18n   | 1 calls     |
| Ai     | 1 calls     |
| App    | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "useCategorySearch"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
