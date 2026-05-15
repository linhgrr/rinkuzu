---
name: components
description: 'Skill for the Components area of rinkuzu. 79 symbols across 28 files.'
---

# Components

79 symbols | 28 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how extractUnknownErrorMessage, ProfileSettings, fetchProfile work
- Modifying components-related functionality

## Key Files

| File                                                      | Symbols                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/features/quiz/components/Flashcard.tsx`              | getCorrectAnswers, getCorrectAnswerText, getCorrectAnswerLetters, getAnimatedCardStyle, Flashcard (+4) |
| `src/features/profile/components/ProfileQuizzes.tsx`      | ProfileQuizzes, fetchMyQuizzes, handleDeleteQuiz, QuizCreatedAt, getStatusColor (+2)                   |
| `src/features/categories/components/CategorySearch.tsx`   | CategorySearch, fetchCategories, loadRecentCategories, saveRecentCategory, handleCategorySelect (+1)   |
| `src/features/profile/components/ProfileSettings.tsx`     | ProfileSettings, fetchProfile, handleSaveProfile, handleChangePassword, handleRemoveAvatar             |
| `src/app/[locale]/(app)/quiz/[slug]/result/page.tsx`      | showBookmarkMessage, removeBookmark, toggleBookmark, useQuizResultPageChat, QuizResultReadyState       |
| `src/features/profile/components/ProfileHistory.tsx`      | ProfileHistory, fetchAttempts, getScoreColor, getPerformanceBadge, AttemptTakenAt                      |
| `src/features/profile/components/ProfileBookmarks.tsx`    | formatCorrectAnswer, BookmarkCard, ProfileBookmarks, removeBookmark                                    |
| `src/features/categories/components/CategorySelector.tsx` | CategorySelector, searchCategories, handleCategorySelect, handleInputFocus                             |
| `src/components/PWAInstaller.tsx`                         | prompt, PWAInstaller, handleInstallClick, shouldShowBanner                                             |
| `src/features/quiz/hooks/useStreamingChatSession.ts`      | useStreamingChatSession, removeHistory, getHistory                                                     |

## Entry Points

Start here when exploring this area:

- **`extractUnknownErrorMessage`** (Function) — `src/lib/api/error.ts:46`
- **`ProfileSettings`** (Function) — `src/features/profile/components/ProfileSettings.tsx:467`
- **`fetchProfile`** (Function) — `src/features/profile/components/ProfileSettings.tsx:481`
- **`handleSaveProfile`** (Function) — `src/features/profile/components/ProfileSettings.tsx:508`
- **`handleChangePassword`** (Function) — `src/features/profile/components/ProfileSettings.tsx:525`

## Key Symbols

| Symbol                       | Type     | File                                                         | Line |
| ---------------------------- | -------- | ------------------------------------------------------------ | ---- |
| `extractUnknownErrorMessage` | Function | `src/lib/api/error.ts`                                       | 46   |
| `ProfileSettings`            | Function | `src/features/profile/components/ProfileSettings.tsx`        | 467  |
| `fetchProfile`               | Function | `src/features/profile/components/ProfileSettings.tsx`        | 481  |
| `handleSaveProfile`          | Function | `src/features/profile/components/ProfileSettings.tsx`        | 508  |
| `handleChangePassword`       | Function | `src/features/profile/components/ProfileSettings.tsx`        | 525  |
| `handleRemoveAvatar`         | Function | `src/features/profile/components/ProfileSettings.tsx`        | 603  |
| `ProfileQuizzes`             | Function | `src/features/profile/components/ProfileQuizzes.tsx`         | 309  |
| `fetchMyQuizzes`             | Function | `src/features/profile/components/ProfileQuizzes.tsx`         | 317  |
| `handleDeleteQuiz`           | Function | `src/features/profile/components/ProfileQuizzes.tsx`         | 374  |
| `handleSubmit`               | Function | `src/app/[locale]/(app)/draft/[id]/edit/DraftEditClient.tsx` | 156  |
| `useStreamingChatSession`    | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`         | 39   |
| `removeHistory`              | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`         | 110  |
| `getHistory`                 | Function | `src/features/quiz/hooks/useStreamingChatSession.ts`         | 122  |
| `ProfileBookmarks`           | Function | `src/features/profile/components/ProfileBookmarks.tsx`       | 280  |
| `removeBookmark`             | Function | `src/features/profile/components/ProfileBookmarks.tsx`       | 321  |
| `QuestionReviewList`         | Function | `src/features/quiz/components/result/QuestionReviewList.tsx` | 50   |
| `useCategorySearch`          | Function | `src/features/categories/hooks/useCategorySearch.ts`         | 9    |
| `useDropdownOutside`         | Function | `src/components/ui/hooks/use-dropdown-outside.ts`            | 5    |
| `CategorySelector`           | Function | `src/features/categories/components/CategorySelector.tsx`    | 23   |
| `searchCategories`           | Function | `src/features/categories/components/CategorySelector.tsx`    | 49   |

## Execution Flows

| Flow                                             | Type            | Steps |
| ------------------------------------------------ | --------------- | ----- |
| `CategorySelector → ParseApiBody`                | cross_community | 5     |
| `CategorySelector → ApiResponseError`            | cross_community | 5     |
| `DraftSyncProvider → ExtractUnknownErrorMessage` | cross_community | 5     |
| `ProfileHistory → ParseApiBody`                  | cross_community | 5     |
| `ProfileHistory → ApiResponseError`              | cross_community | 5     |
| `ProfileBookmarks → ParseApiBody`                | cross_community | 5     |
| `ProfileBookmarks → ApiResponseError`            | cross_community | 5     |
| `AdaptiveLearningGuest → NormalizeSeoPath`       | cross_community | 5     |
| `AdaptiveLearningGuest → LocalePrefix`           | cross_community | 5     |
| `CategorySearch → ParseApiBody`                  | cross_community | 5     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Categories | 12 calls    |
| App        | 1 calls     |
| Api        | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "extractUnknownErrorMessage"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
