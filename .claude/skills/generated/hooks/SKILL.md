---
name: hooks
description: 'Skill for the Hooks area of rinkuzu. 57 symbols across 20 files.'
---

# Hooks

57 symbols | 20 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how useQuizViewport, checkMobile, useQuizSubmission work
- Modifying hooks-related functionality

## Key Files

| File                                                                    | Symbols                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/features/adaptive-learning/lib/api-client.ts`                      | getNextConcept, getTheory, getExercise, submitAnswer, checkApiHealth (+14)                    |
| `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | applyHealthResult, hydrateDashboard, toTimestampMs, getDayStart, calculateLearningStreak (+2) |
| `src/app/[locale]/(app)/quiz/[slug]/page.tsx`                           | isQuestionAnswered, mapAnswersToOriginalOrder, QuizPlayerPage                                 |
| `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | resolveExerciseFeedback, useAdaptiveExerciseSession, isLatestActiveRequest                    |
| `src/features/adaptive-learning/hooks/use-processing-state.ts`          | getStoredFilename, useProcessingState, applyMatch                                             |
| `src/features/adaptive-learning/hooks/use-result-state.ts`              | deriveOutcomeFromHistory, useResultState, hydrate                                             |
| `src/features/quiz/hooks/useQuizViewport.ts`                            | useQuizViewport, checkMobile                                                                  |
| `src/features/adaptive-learning/lib/session-storage.ts`                 | saveSessionJobMapping, getJobIdForSession                                                     |
| `src/features/adaptive-learning/hooks/use-subject-details-state.ts`     | useSubjectDetailsState, bootstrap                                                             |
| `src/hooks/useAdaptiveLearning.ts`                                      | useKnowledgeGraph, useConceptDetail                                                           |

## Entry Points

Start here when exploring this area:

- **`useQuizViewport`** (Function) — `src/features/quiz/hooks/useQuizViewport.ts:6`
- **`checkMobile`** (Function) — `src/features/quiz/hooks/useQuizViewport.ts:10`
- **`useQuizSubmission`** (Function) — `src/features/quiz/hooks/useQuizSubmission.ts:20`
- **`useQuizAIExplain`** (Function) — `src/features/quiz/hooks/useQuizAIExplain.ts:12`
- **`QuizPlayerPage`** (Function) — `src/app/[locale]/(app)/quiz/[slug]/page.tsx:226`

## Key Symbols

| Symbol                       | Type     | File                                                                    | Line |
| ---------------------------- | -------- | ----------------------------------------------------------------------- | ---- |
| `useQuizViewport`            | Function | `src/features/quiz/hooks/useQuizViewport.ts`                            | 6    |
| `checkMobile`                | Function | `src/features/quiz/hooks/useQuizViewport.ts`                            | 10   |
| `useQuizSubmission`          | Function | `src/features/quiz/hooks/useQuizSubmission.ts`                          | 20   |
| `useQuizAIExplain`           | Function | `src/features/quiz/hooks/useQuizAIExplain.ts`                           | 12   |
| `QuizPlayerPage`             | Function | `src/app/[locale]/(app)/quiz/[slug]/page.tsx`                           | 226  |
| `getNextConcept`             | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 319  |
| `getTheory`                  | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 325  |
| `getExercise`                | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 331  |
| `submitAnswer`               | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 337  |
| `useAdaptiveExerciseSession` | Function | `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | 55   |
| `isLatestActiveRequest`      | Function | `src/features/adaptive-learning/hooks/use-adaptive-exercise-session.ts` | 97   |
| `AdaptiveLearningUpload`     | Function | `src/components/adaptive-learning/Upload.tsx`                           | 21   |
| `checkApiHealth`             | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 377  |
| `getSubjectProgressHistory`  | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 475  |
| `getSubjects`                | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 513  |
| `applyHealthResult`          | Function | `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | 207  |
| `hydrateDashboard`           | Function | `src/features/adaptive-learning/hooks/use-adaptive-dashboard.ts`        | 212  |
| `saveSessionJobMapping`      | Function | `src/features/adaptive-learning/lib/session-storage.ts`                 | 36   |
| `getSessionStartFeedback`    | Function | `src/features/adaptive-learning/lib/session-start-feedback.ts`          | 6    |
| `createSessionFromPipeline`  | Function | `src/features/adaptive-learning/lib/api-client.ts`                      | 454  |

## Execution Flows

| Flow                                      | Type            | Steps |
| ----------------------------------------- | --------------- | ----- |
| `KnowledgeGraph → Abort`                  | cross_community | 6     |
| `KnowledgeGraph → IsAbortLikeError`       | cross_community | 6     |
| `UseAdaptiveDashboard → Abort`            | cross_community | 5     |
| `UseAdaptiveDashboard → IsAbortLikeError` | cross_community | 5     |
| `UseAdaptiveDashboard → AdaptiveApiError` | cross_community | 5     |
| `UseAdaptiveDashboard → ReadErrorDetail`  | cross_community | 5     |
| `UseProcessingState → Abort`              | cross_community | 5     |
| `UseProcessingState → IsAbortLikeError`   | cross_community | 5     |
| `UseProcessingState → AdaptiveApiError`   | cross_community | 5     |
| `UseProcessingState → ReadErrorDetail`    | cross_community | 5     |

## Connected Areas

| Area              | Connections |
| ----------------- | ----------- |
| Cluster_110       | 13 calls    |
| Cluster_102       | 3 calls     |
| Result            | 2 calls     |
| Cluster_108       | 2 calls     |
| Cluster_101       | 2 calls     |
| Ui                | 2 calls     |
| Adaptive-learning | 1 calls     |
| Flashcards        | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "useQuizViewport"})` — see callers and callees
2. `gitnexus_query({query: "hooks"})` — find related execution flows
3. Read key files listed above for implementation details
