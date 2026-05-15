---
name: adaptive-learning
description: 'Skill for the Adaptive-learning area of rinkuzu. 54 symbols across 20 files.'
---

# Adaptive-learning

54 symbols | 20 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how AdaptiveLearningUpload, checkApiHealth, uploadPdf work
- Modifying adaptive-learning-related functionality

## Key Files

| File                                                                  | Symbols                                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/features/adaptive-learning/lib/adaptive-api-fetch.ts`            | isAbortLikeError, normalizeNetworkFailure, looksLikeHtmlPayload, normalizeAdaptiveError, parseJsonText (+5) |
| `src/components/adaptive-learning/MasteryMatrix.tsx`                  | getMasteryColor, getMasteryTextColor, getMasteryBand, getAverage, MasteryMatrix                             |
| `src/components/adaptive-learning/exercise-renderers.tsx`             | getExerciseHeaderContent, ExerciseQuestionView, formatPercent, ExerciseRationale                            |
| `src/components/adaptive-learning/ExerciseHistoryTable.tsx`           | ExercisePromptView, getSelectedChoiceKeys, SelectedChoicesSummary, SelectedOptionsList                      |
| `src/lib/adaptive-learning/proxy.ts`                                  | buildTargetUrl, mergeAbortSignals, abort, handleAbort                                                       |
| `src/features/adaptive-learning/lib/adaptive-api-methods.ts`          | checkApiHealth, uploadPdf, getMasteryMatrix                                                                 |
| `src/components/adaptive-learning/exercise-question-interaction.tsx`  | ExerciseInteraction, MatchingInteraction, measureCards                                                      |
| `src/lib/adaptive-learning/config.ts`                                 | resolveAdaptiveApiUrl, buildAdaptiveServiceHeaders, resolveAdaptiveProxyTimeoutMs                           |
| `src/features/adaptive-learning/lib/exercise-prompt.ts`               | normalizePromptText, getExercisePromptSections                                                              |
| `src/app/[locale]/(app)/adaptive-learning/_lib/fetch-initial-data.ts` | fetchAdaptiveJson, fetchAdaptiveDashboardData                                                               |

## Entry Points

Start here when exploring this area:

- **`AdaptiveLearningUpload`** (Function) — `src/components/adaptive-learning/Upload.tsx:23`
- **`checkApiHealth`** (Function) — `src/features/adaptive-learning/lib/adaptive-api-methods.ts:90`
- **`uploadPdf`** (Function) — `src/features/adaptive-learning/lib/adaptive-api-methods.ts:101`
- **`useMasteryMatrix`** (Function) — `src/hooks/useAdaptiveLearning.ts:19`
- **`MasteryMatrix`** (Function) — `src/components/adaptive-learning/MasteryMatrix.tsx:65`

## Key Symbols

| Symbol                          | Type     | File                                                                  | Line |
| ------------------------------- | -------- | --------------------------------------------------------------------- | ---- |
| `AdaptiveApiError`              | Class    | `src/features/adaptive-learning/lib/adaptive-api-error.ts`            | 0    |
| `AdaptiveLearningUpload`        | Function | `src/components/adaptive-learning/Upload.tsx`                         | 23   |
| `checkApiHealth`                | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`          | 90   |
| `uploadPdf`                     | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`          | 101  |
| `useMasteryMatrix`              | Function | `src/hooks/useAdaptiveLearning.ts`                                    | 19   |
| `MasteryMatrix`                 | Function | `src/components/adaptive-learning/MasteryMatrix.tsx`                  | 65   |
| `getMasteryMatrix`              | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`          | 72   |
| `ExerciseQuestionView`          | Function | `src/components/adaptive-learning/exercise-renderers.tsx`             | 310  |
| `ExerciseInteraction`           | Function | `src/components/adaptive-learning/exercise-question-interaction.tsx`  | 219  |
| `getExercisePromptSections`     | Function | `src/features/adaptive-learning/lib/exercise-prompt.ts`               | 32   |
| `extractQuizFromS3Key`          | Function | `src/lib/quiz/extractApi.ts`                                          | 23   |
| `resolveAdaptiveApiUrl`         | Function | `src/lib/adaptive-learning/config.ts`                                 | 5    |
| `buildAdaptiveServiceHeaders`   | Function | `src/lib/adaptive-learning/config.ts`                                 | 17   |
| `handleAvatarUpload`            | Function | `src/features/profile/components/ProfileSettings.tsx`                 | 555  |
| `resolveAdaptiveProxyTimeoutMs` | Function | `src/lib/adaptive-learning/config.ts`                                 | 9    |
| `fetchAdaptiveDashboardData`    | Function | `src/app/[locale]/(app)/adaptive-learning/_lib/fetch-initial-data.ts` | 80   |
| `SubjectDetailsTabs`            | Function | `src/components/adaptive-learning/SubjectDetailsSections.tsx`         | 201  |
| `handleKeyDown`                 | Function | `src/components/adaptive-learning/SubjectDetailsSections.tsx`         | 210  |
| `isAbortLikeError`              | Function | `src/features/adaptive-learning/lib/adaptive-api-fetch.ts`            | 38   |
| `normalizeNetworkFailure`       | Function | `src/features/adaptive-learning/lib/adaptive-api-fetch.ts`            | 42   |

## Execution Flows

| Flow                                    | Type            | Steps |
| --------------------------------------- | --------------- | ----- |
| `UseProcessingState → IsAbortLikeError` | cross_community | 7     |
| `UseProcessingState → AdaptiveApiError` | cross_community | 7     |
| `MasteryMatrix → Abort`                 | cross_community | 7     |
| `MasteryMatrix → ParseJsonText`         | cross_community | 7     |
| `MasteryMatrix → LooksLikeHtmlPayload`  | cross_community | 7     |
| `MasteryMatrix → AdaptiveApiError`      | cross_community | 7     |
| `UseResultState → IsAbortLikeError`     | cross_community | 7     |
| `UseAdaptiveDashboard → Abort`          | cross_community | 6     |
| `UseAdaptiveDashboard → ParseJsonText`  | cross_community | 6     |
| `UseProcessingState → Abort`            | cross_community | 6     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Categories | 2 calls     |
| Hooks      | 2 calls     |
| Components | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "AdaptiveLearningUpload"})` — see callers and callees
2. `gitnexus_query({query: "adaptive-learning"})` — find related execution flows
3. Read key files listed above for implementation details
