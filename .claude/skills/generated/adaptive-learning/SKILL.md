---
name: adaptive-learning
description: 'Skill for the Adaptive-learning area of rinkuzu. 66 symbols across 28 files.'
---

# Adaptive-learning

66 symbols | 28 files | Cohesion: 84%

## When to Use

- Working with code in `src/`
- Understanding how classifyAdaptiveLlmAction, checkLlmRateLimit, buildLlmRateLimitHeaders work
- Modifying adaptive-learning-related functionality

## Key Files

| File                                                                 | Symbols                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/lib/adaptive-learning/proxy.ts`                                 | shouldAttachBody, isHtmlResponse, mergeAbortSignals, abort, handleAbort (+3)                                           |
| `src/components/adaptive-learning/ExerciseHistoryTable.tsx`          | renderAnswerText, getSelectedChoiceKeys, renderCorrectAnswer, renderSelectedChoicesSummary, renderSelectedOptions (+2) |
| `src/lib/llm/rate-limit.ts`                                          | retryAfterSeconds, classifyAdaptiveLlmAction, checkLlmRateLimit, buildLlmRateLimitHeaders, buildLlmRateLimitResponse   |
| `src/components/adaptive-learning/MasteryMatrix.tsx`                 | getMasteryColor, getMasteryTextColor, getMasteryBand, getAverage, MasteryMatrix                                        |
| `src/components/adaptive-learning/exercise-renderers.tsx`            | getExerciseHeaderContent, ExerciseQuestionView, formatPercent, ExerciseRationale                                       |
| `src/components/adaptive-learning/exercise-question-interaction.tsx` | ExerciseInteraction, MatchingInteraction, measureCards                                                                 |
| `src/lib/adaptive-learning/config.ts`                                | resolveAdaptiveApiUrl, buildAdaptiveServiceHeaders, resolveAdaptiveProxyTimeoutMs                                      |
| `src/components/adaptive-learning/ResultSections.tsx`                | normalizeMathContent, renderResultCorrectAnswer, ResultContent                                                         |
| `src/lib/adaptive-learning/cache-policy.ts`                          | isCacheSafeAdaptivePath, invalidateAdaptiveServiceCache                                                                |
| `src/app/api/adaptive-learning/session/[...path]/route.ts`           | GET, POST                                                                                                              |

## Entry Points

Start here when exploring this area:

- **`classifyAdaptiveLlmAction`** (Function) — `src/lib/llm/rate-limit.ts:123`
- **`checkLlmRateLimit`** (Function) — `src/lib/llm/rate-limit.ts:144`
- **`buildLlmRateLimitHeaders`** (Function) — `src/lib/llm/rate-limit.ts:171`
- **`buildLlmRateLimitResponse`** (Function) — `src/lib/llm/rate-limit.ts:187`
- **`proxyAdaptiveRequest`** (Function) — `src/lib/adaptive-learning/proxy.ts:92`

## Key Symbols

| Symbol                           | Type     | File                                                                          | Line |
| -------------------------------- | -------- | ----------------------------------------------------------------------------- | ---- |
| `classifyAdaptiveLlmAction`      | Function | `src/lib/llm/rate-limit.ts`                                                   | 123  |
| `checkLlmRateLimit`              | Function | `src/lib/llm/rate-limit.ts`                                                   | 144  |
| `buildLlmRateLimitHeaders`       | Function | `src/lib/llm/rate-limit.ts`                                                   | 171  |
| `buildLlmRateLimitResponse`      | Function | `src/lib/llm/rate-limit.ts`                                                   | 187  |
| `proxyAdaptiveRequest`           | Function | `src/lib/adaptive-learning/proxy.ts`                                          | 92   |
| `isCacheSafeAdaptivePath`        | Function | `src/lib/adaptive-learning/cache-policy.ts`                                   | 5    |
| `invalidateAdaptiveServiceCache` | Function | `src/lib/adaptive-learning/cache-policy.ts`                                   | 9    |
| `POST`                           | Function | `src/app/api/quiz/ask-ai/route.ts`                                            | 7    |
| `GET`                            | Function | `src/app/api/adaptive-learning/subjects/route.ts`                             | 5    |
| `GET`                            | Function | `src/app/api/adaptive-learning/health/route.ts`                               | 5    |
| `GET`                            | Function | `src/app/api/adaptive-learning/session/[...path]/route.ts`                    | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/session/[...path]/route.ts`                    | 10   |
| `GET`                            | Function | `src/app/api/adaptive-learning/pipeline/status/route.ts`                      | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/pipeline/process/route.ts`                     | 9    |
| `GET`                            | Function | `src/app/api/adaptive-learning/history/[...path]/route.ts`                    | 5    |
| `DELETE`                         | Function | `src/app/api/adaptive-learning/history/[...path]/route.ts`                    | 10   |
| `GET`                            | Function | `src/app/api/adaptive-learning/pipeline/jobs/[jobId]/route.ts`                | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/pipeline/jobs/[jobId]/create-session/route.ts` | 6    |
| `useMasteryMatrix`               | Function | `src/hooks/useAdaptiveLearning.ts`                                            | 23   |
| `MasteryMatrix`                  | Function | `src/components/adaptive-learning/MasteryMatrix.tsx`                          | 65   |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `MasteryMatrix → Abort`              | cross_community | 6     |
| `MasteryMatrix → IsAbortLikeError`   | cross_community | 6     |
| `MasteryMatrix → AdaptiveApiError`   | cross_community | 6     |
| `MasteryMatrix → ReadErrorDetail`    | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `KnowledgeGraph → Abort`             | cross_community | 6     |
| `GET → IsExpired`                    | cross_community | 6     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Subscription | 2 calls     |
| Hooks        | 2 calls     |
| Repositories | 1 calls     |
| Llm          | 1 calls     |
| Cluster_110  | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "classifyAdaptiveLlmAction"})` — see callers and callees
2. `gitnexus_query({query: "adaptive-learning"})` — find related execution flows
3. Read key files listed above for implementation details
