---
name: ai
description: 'Skill for the Ai area of rinkuzu. 11 symbols across 3 files.'
---

# Ai

11 symbols | 3 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how consumeOpenAISseResponse, consumeReader, streamAdaptiveTutorChat work
- Modifying ai-related functionality

## Key Files

| File                                           | Symbols                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/lib/ai/stream.ts`                         | parseJsonResponse, splitSseEvents, consumeOpenAISseResponse, consumeReader, createStreamError (+3) |
| `src/components/adaptive-learning/Chatbot.tsx` | isAbortLikeError, AdaptiveLearningChatbot                                                          |
| `src/lib/adaptive-learning/chat.ts`            | streamAdaptiveTutorChat                                                                            |

## Entry Points

Start here when exploring this area:

- **`consumeOpenAISseResponse`** (Function) — `src/lib/ai/stream.ts:188`
- **`consumeReader`** (Function) — `src/lib/ai/stream.ts:222`
- **`streamAdaptiveTutorChat`** (Function) — `src/lib/adaptive-learning/chat.ts:17`
- **`AdaptiveLearningChatbot`** (Function) — `src/components/adaptive-learning/Chatbot.tsx:52`

## Key Symbols

| Symbol                      | Type     | File                                           | Line |
| --------------------------- | -------- | ---------------------------------------------- | ---- |
| `consumeOpenAISseResponse`  | Function | `src/lib/ai/stream.ts`                         | 188  |
| `consumeReader`             | Function | `src/lib/ai/stream.ts`                         | 222  |
| `streamAdaptiveTutorChat`   | Function | `src/lib/adaptive-learning/chat.ts`            | 17   |
| `AdaptiveLearningChatbot`   | Function | `src/components/adaptive-learning/Chatbot.tsx` | 52   |
| `parseJsonResponse`         | Function | `src/lib/ai/stream.ts`                         | 48   |
| `splitSseEvents`            | Function | `src/lib/ai/stream.ts`                         | 93   |
| `isAbortLikeError`          | Function | `src/components/adaptive-learning/Chatbot.tsx` | 26   |
| `createStreamError`         | Function | `src/lib/ai/stream.ts`                         | 38   |
| `extractOpenAIDeltaContent` | Function | `src/lib/ai/stream.ts`                         | 59   |
| `isTerminalOpenAIEvent`     | Function | `src/lib/ai/stream.ts`                         | 110  |
| `parseSseEvent`             | Function | `src/lib/ai/stream.ts`                         | 127  |

## Execution Flows

| Flow                                                  | Type            | Steps |
| ----------------------------------------------------- | --------------- | ----- |
| `AdaptiveLearningChatbot → CreateStreamError`         | cross_community | 6     |
| `AdaptiveLearningChatbot → ExtractOpenAIDeltaContent` | cross_community | 6     |
| `AdaptiveLearningChatbot → IsTerminalOpenAIEvent`     | cross_community | 6     |
| `AdaptiveLearningChatbot → SplitSseEvents`            | intra_community | 5     |
| `AdaptiveLearningChatbot → ParseJsonResponse`         | intra_community | 4     |

## Connected Areas

| Area              | Connections |
| ----------------- | ----------- |
| Adaptive-learning | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "consumeOpenAISseResponse"})` — see callers and callees
2. `gitnexus_query({query: "ai"})` — find related execution flows
3. Read key files listed above for implementation details
