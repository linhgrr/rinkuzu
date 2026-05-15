---
name: llm
description: 'Skill for the Llm area of rinkuzu. 27 symbols across 12 files.'
---

# Llm

27 symbols | 12 files | Cohesion: 81%

## When to Use

- Working with code in `src/`
- Understanding how isAdminRole, classifyAdaptiveLlmAction, checkLlmRateLimit work
- Modifying llm-related functionality

## Key Files

| File                                                       | Symbols                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/llm/rate-limit.ts`                                | isAdminRole, retryAfterSeconds, classifyAdaptiveLlmAction, checkLlmRateLimit, buildLlmRateLimitHeaders (+5) |
| `src/lib/adaptive-learning/proxy.ts`                       | shouldAttachBody, isHtmlResponse, copyUpstreamResponseHeaders, proxyAdaptiveRequest                         |
| `src/lib/adaptive-learning/cache-policy.ts`                | isCacheSafeAdaptivePath, invalidateAdaptiveServiceCache                                                     |
| `src/app/api/adaptive-learning/session/[...path]/route.ts` | GET, POST                                                                                                   |
| `src/app/api/adaptive-learning/history/[...path]/route.ts` | GET, DELETE                                                                                                 |
| `src/app/api/quiz/ask-ai/route.ts`                         | POST                                                                                                        |
| `src/app/api/adaptive-learning/subjects/route.ts`          | GET                                                                                                         |
| `src/app/api/adaptive-learning/health/route.ts`            | GET                                                                                                         |
| `src/app/api/adaptive-learning/pipeline/status/route.ts`   | GET                                                                                                         |
| `src/app/api/adaptive-learning/pipeline/process/route.ts`  | POST                                                                                                        |

## Entry Points

Start here when exploring this area:

- **`isAdminRole`** (Function) — `src/lib/llm/rate-limit.ts:39`
- **`classifyAdaptiveLlmAction`** (Function) — `src/lib/llm/rate-limit.ts:128`
- **`checkLlmRateLimit`** (Function) — `src/lib/llm/rate-limit.ts:149`
- **`buildLlmRateLimitHeaders`** (Function) — `src/lib/llm/rate-limit.ts:181`
- **`buildLlmRateLimitResponse`** (Function) — `src/lib/llm/rate-limit.ts:197`

## Key Symbols

| Symbol                           | Type     | File                                                                          | Line |
| -------------------------------- | -------- | ----------------------------------------------------------------------------- | ---- |
| `isAdminRole`                    | Function | `src/lib/llm/rate-limit.ts`                                                   | 39   |
| `classifyAdaptiveLlmAction`      | Function | `src/lib/llm/rate-limit.ts`                                                   | 128  |
| `checkLlmRateLimit`              | Function | `src/lib/llm/rate-limit.ts`                                                   | 149  |
| `buildLlmRateLimitHeaders`       | Function | `src/lib/llm/rate-limit.ts`                                                   | 181  |
| `buildLlmRateLimitResponse`      | Function | `src/lib/llm/rate-limit.ts`                                                   | 197  |
| `proxyAdaptiveRequest`           | Function | `src/lib/adaptive-learning/proxy.ts`                                          | 92   |
| `isCacheSafeAdaptivePath`        | Function | `src/lib/adaptive-learning/cache-policy.ts`                                   | 5    |
| `invalidateAdaptiveServiceCache` | Function | `src/lib/adaptive-learning/cache-policy.ts`                                   | 9    |
| `POST`                           | Function | `src/app/api/quiz/ask-ai/route.ts`                                            | 7    |
| `GET`                            | Function | `src/app/api/adaptive-learning/subjects/route.ts`                             | 4    |
| `GET`                            | Function | `src/app/api/adaptive-learning/health/route.ts`                               | 5    |
| `GET`                            | Function | `src/app/api/adaptive-learning/session/[...path]/route.ts`                    | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/session/[...path]/route.ts`                    | 10   |
| `GET`                            | Function | `src/app/api/adaptive-learning/pipeline/status/route.ts`                      | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/pipeline/process/route.ts`                     | 9    |
| `GET`                            | Function | `src/app/api/adaptive-learning/history/[...path]/route.ts`                    | 5    |
| `DELETE`                         | Function | `src/app/api/adaptive-learning/history/[...path]/route.ts`                    | 10   |
| `GET`                            | Function | `src/app/api/adaptive-learning/pipeline/jobs/[jobId]/route.ts`                | 5    |
| `POST`                           | Function | `src/app/api/adaptive-learning/pipeline/jobs/[jobId]/create-session/route.ts` | 6    |
| `retryAfterSeconds`              | Function | `src/lib/llm/rate-limit.ts`                                                   | 95   |

## Execution Flows

| Flow                                 | Type            | Steps |
| ------------------------------------ | --------------- | ----- |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |
| `POST → MarkUserSubscriptionExpired` | cross_community | 6     |
| `GET → IsExpired`                    | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → IsExpired`                    | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `GET → IsExpired`                    | cross_community | 6     |
| `GET → MarkUserSubscriptionExpired`  | cross_community | 6     |
| `POST → IsExpired`                   | cross_community | 6     |

## Connected Areas

| Area              | Connections |
| ----------------- | ----------- |
| Adaptive-learning | 5 calls     |
| Quiz              | 3 calls     |
| Repositories      | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "isAdminRole"})` — see callers and callees
2. `gitnexus_query({query: "llm"})` — find related execution flows
3. Read key files listed above for implementation details
