---
name: hooks
description: 'Skill for the Hooks area of rinkuzu. 77 symbols across 30 files.'
---

# Hooks

77 symbols | 30 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how saveSessionJobMapping, getSessionStartFeedback, createSessionFromPipeline work
- Modifying hooks-related functionality

## Key Files

| File                                                                    | Symbols                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | createSessionFromPipeline, getSubjectProgressHistory, getSubjectHistoryDetail, getSubjects, getNextConcept (+10) |
| `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | toTimestampMs, getDayStart, calculateLearningStreak, clearSelectedPipelineJob, useAdaptiveDashboard (+1)         |
| `src/features/adaptive-learning/lib/adaptive-api-fetch.ts`              | readCachedResponse, writeCachedResponse, invalidateCacheByPrefixes, apiFetch                                     |
| `src/features/adaptive-learning/lib/session-storage.ts`                 | writeSessionJobMap, saveSessionJobMapping, getJobIdForSession                                                    |
| `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | resolveExerciseFeedback, useAdaptiveExerciseSession, isLatestActiveRequest                                       |
| `src/hooks/usePdfProcessor.ts`                                          | fetchWithRetry, attemptFetch, usePdfProcessor                                                                    |
| `src/components/providers/DraftSyncProvider.tsx`                        | DraftSyncProvider, initSync, checkAndResume                                                                      |
| `src/features/quiz/hooks/useStreamingChatSession.ts`                    | setUserQuestion, setAIError, ensureHistory                                                                       |
| `src/app/[locale]/(app)/quiz/[slug]/page.tsx`                           | isQuestionAnswered, mapAnswersToOriginalOrder, QuizPlayerPage                                                    |
| `src/features/adaptive-learning/hooks/use-result-state.ts`              | deriveOutcomeFromHistory, useResultState, hydrate                                                                |

## Entry Points

Start here when exploring this area:

- **`saveSessionJobMapping`** (Function) — `src/features/adaptive-learning/lib/session-storage.ts:36`
- **`getSessionStartFeedback`** (Function) — `src/features/adaptive-learning/lib/session-start-feedback.ts:5`
- **`createSessionFromPipeline`** (Function) — `src/features/adaptive-learning/lib/adaptive-api-methods.ts:175`
- **`getSubjectProgressHistory`** (Function) — `src/features/adaptive-learning/lib/adaptive-api-methods.ts:187`
- **`getSubjectHistoryDetail`** (Function) — `src/features/adaptive-learning/lib/adaptive-api-methods.ts:195`

## Key Symbols

| Symbol                       | Type     | File                                                                    | Line |
| ---------------------------- | -------- | ----------------------------------------------------------------------- | ---- |
| `saveSessionJobMapping`      | Function | `src/features/adaptive-learning/lib/session-storage.ts`                 | 36   |
| `getSessionStartFeedback`    | Function | `src/features/adaptive-learning/lib/session-start-feedback.ts`          | 5    |
| `createSessionFromPipeline`  | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 175  |
| `getSubjectProgressHistory`  | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 187  |
| `getSubjectHistoryDetail`    | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 195  |
| `getSubjects`                | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 217  |
| `useSubjectDetailsState`     | Function | `src/features/adaptive-learning/hooks/use-subject-details-state.ts`     | 69   |
| `useSessionHistoryState`     | Function | `src/features/adaptive-learning/hooks/use-session-history-state.ts`     | 41   |
| `useAdaptiveDashboard`       | Function | `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | 106  |
| `hydrateDashboard`           | Function | `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | 239  |
| `getNextConcept`             | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 32   |
| `getTheory`                  | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 38   |
| `getExercise`                | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 44   |
| `submitAnswer`               | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 50   |
| `deleteSubject`              | Function | `src/features/adaptive-learning/lib/adaptive-api-methods.ts`            | 224  |
| `useAdaptiveExerciseSession` | Function | `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | 55   |
| `isLatestActiveRequest`      | Function | `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | 97   |
| `mapWithConcurrency`         | Function | `src/lib/asyncPool.ts`                                                  | 4    |
| `runWorker`                  | Function | `src/lib/asyncPool.ts`                                                  | 16   |
| `usePdfProcessor`            | Function | `src/hooks/usePdfProcessor.ts`                                          | 65   |

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

| Area              | Connections |
| ----------------- | ----------- |
| Adaptive-learning | 5 calls     |
| Categories        | 4 calls     |
| Cluster_132       | 4 calls     |
| Components        | 2 calls     |
| Ui                | 2 calls     |
| Result            | 2 calls     |
| User              | 1 calls     |
| Quiz              | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "saveSessionJobMapping"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
