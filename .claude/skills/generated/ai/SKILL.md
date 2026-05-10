---
name: ai
description: 'Skill for the Ai area of rinkuzu. 14 symbols across 5 files.'
---

# Ai

14 symbols | 5 files | Cohesion: 91%

## When to Use

- Working with code in `src/`
- Understanding how askQuizAI, streamQuizAI, createStreamError work
- Modifying ai-related functionality

## Key Files

| File                                           | Symbols                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/stream.ts`                         | createStreamError, parseJsonResponse, extractOpenAIDeltaContent, splitSseEvents, isTerminalOpenAIEvent (+2) |
| `src/lib/quiz/ask-ai.ts`                       | requestQuizAI, askQuizAI, streamQuizAI                                                                      |
| `src/components/adaptive-learning/Chatbot.tsx` | isAbortLikeError, AdaptiveLearningChatbot                                                                   |
| `src/lib/adaptive-learning/chat.ts`            | streamAdaptiveTutorChat                                                                                     |
| `src/features/quiz/hooks/useQuizAIExplain.ts`  | askAI                                                                                                       |

## Entry Points

Start here when exploring this area:

- **`askQuizAI`** (Function) — `src/lib/quiz/ask-ai.ts:44`
- **`streamQuizAI`** (Function) — `src/lib/quiz/ask-ai.ts:58`
- **`createStreamError`** (Function) — `src/lib/ai/stream.ts:4`
- **`parseJsonResponse`** (Function) — `src/lib/ai/stream.ts:14`
- **`extractOpenAIDeltaContent`** (Function) — `src/lib/ai/stream.ts:19`

## Key Symbols

| Symbol                      | Type     | File                                           | Line |
| --------------------------- | -------- | ---------------------------------------------- | ---- |
| `askQuizAI`                 | Function | `src/lib/quiz/ask-ai.ts`                       | 44   |
| `streamQuizAI`              | Function | `src/lib/quiz/ask-ai.ts`                       | 58   |
| `createStreamError`         | Function | `src/lib/ai/stream.ts`                         | 4    |
| `parseJsonResponse`         | Function | `src/lib/ai/stream.ts`                         | 14   |
| `extractOpenAIDeltaContent` | Function | `src/lib/ai/stream.ts`                         | 19   |
| `splitSseEvents`            | Function | `src/lib/ai/stream.ts`                         | 49   |
| `isTerminalOpenAIEvent`     | Function | `src/lib/ai/stream.ts`                         | 66   |
| `parseSseEvent`             | Function | `src/lib/ai/stream.ts`                         | 75   |
| `consumeOpenAISseResponse`  | Function | `src/lib/ai/stream.ts`                         | 119  |
| `streamAdaptiveTutorChat`   | Function | `src/lib/adaptive-learning/chat.ts`            | 17   |
| `askAI`                     | Function | `src/features/quiz/hooks/useQuizAIExplain.ts`  | 19   |
| `AdaptiveLearningChatbot`   | Function | `src/components/adaptive-learning/Chatbot.tsx` | 52   |
| `requestQuizAI`             | Function | `src/lib/quiz/ask-ai.ts`                       | 35   |
| `isAbortLikeError`          | Function | `src/components/adaptive-learning/Chatbot.tsx` | 26   |

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
| `HandleKeyPress → ParseJsonResponse`         | cross_community | 6     |
| `HandleKeyPress → SplitSseEvents`            | cross_community | 6     |

## Connected Areas

| Area              | Connections |
| ----------------- | ----------- |
| Adaptive-learning | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "askQuizAI"})` — see callers and callees
2. `gitnexus_query({query: "ai"})` — find related execution flows
3. Read key files listed above for implementation details
