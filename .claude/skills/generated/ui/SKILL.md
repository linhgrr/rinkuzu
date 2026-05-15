---
name: ui
description: 'Skill for the Ui area of rinkuzu. 41 symbols across 15 files.'
---

# Ui

41 symbols | 15 files | Cohesion: 89%

## When to Use

- Working with code in `src/`
- Understanding how cn, TextShimmer, Modal work
- Modifying ui-related functionality

## Key Files

| File                                               | Symbols                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/components/ui/StatsModal.tsx`                 | getDataKey, StatsModalBody, handleSearch, handlePageChange, handleLoadMore (+7) |
| `src/components/ui/Card.tsx`                       | Card, CardHeader, CardTitle, CardDescription, CardContent (+2)                  |
| `src/components/ui/sparkles-text.tsx`              | SparklesText, createSparkle, createSparkles, SparklesLayer                      |
| `src/app/[locale]/(app)/quiz/[slug]/page.tsx`      | shuffleArray, createQuizPlayerData, loadQuiz                                    |
| `src/components/ui/MarkdownRenderer.tsx`           | normalizeLatexEscapes, MarkdownRenderer                                         |
| `src/components/ui/Input.tsx`                      | Input, Textarea                                                                 |
| `src/features/dashboard/components/LevelBadge.tsx` | LevelBadge, random                                                              |
| `src/components/ui/Pagination.tsx`                 | Pagination, getVisiblePages                                                     |
| `src/lib/utils.ts`                                 | cn                                                                              |
| `src/components/ui/text-shimmer.tsx`               | TextShimmer                                                                     |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `src/lib/utils.ts:17`
- **`TextShimmer`** (Function) — `src/components/ui/text-shimmer.tsx:8`
- **`Modal`** (Function) — `src/components/ui/Modal.tsx:17`
- **`MarkdownRenderer`** (Function) — `src/components/ui/MarkdownRenderer.tsx:34`
- **`LevelBadge`** (Function) — `src/features/dashboard/components/LevelBadge.tsx:7`

## Key Symbols

| Symbol                  | Type     | File                                               | Line |
| ----------------------- | -------- | -------------------------------------------------- | ---- |
| `cn`                    | Function | `src/lib/utils.ts`                                 | 17   |
| `TextShimmer`           | Function | `src/components/ui/text-shimmer.tsx`               | 8    |
| `Modal`                 | Function | `src/components/ui/Modal.tsx`                      | 17   |
| `MarkdownRenderer`      | Function | `src/components/ui/MarkdownRenderer.tsx`           | 34   |
| `LevelBadge`            | Function | `src/features/dashboard/components/LevelBadge.tsx` | 7    |
| `random`                | Function | `src/features/dashboard/components/LevelBadge.tsx` | 12   |
| `loadQuiz`              | Function | `src/app/[locale]/(app)/quiz/[slug]/page.tsx`      | 570  |
| `loadData`              | Function | `src/components/ui/StatsModal.tsx`                 | 649  |
| `handleSortChange`      | Function | `src/components/ui/StatsModal.tsx`                 | 685  |
| `StatsModal`            | Function | `src/components/ui/StatsModal.tsx`                 | 636  |
| `SparklesText`          | Function | `src/components/ui/sparkles-text.tsx`              | 117  |
| `Switch`                | Function | `src/components/ui/Switch.tsx`                     | 9    |
| `Separator`             | Function | `src/components/ui/Separator.tsx`                  | 9    |
| `normalizeLatexEscapes` | Function | `src/components/ui/MarkdownRenderer.tsx`           | 25   |
| `Input`                 | Function | `src/components/ui/Input.tsx`                      | 13   |
| `Textarea`              | Function | `src/components/ui/Input.tsx`                      | 89   |
| `Card`                  | Function | `src/components/ui/Card.tsx`                       | 9    |
| `CardHeader`            | Function | `src/components/ui/Card.tsx`                       | 39   |
| `CardTitle`             | Function | `src/components/ui/Card.tsx`                       | 51   |
| `CardDescription`       | Function | `src/components/ui/Card.tsx`                       | 73   |

## Execution Flows

| Flow                    | Type            | Steps |
| ----------------------- | --------------- | ----- |
| `HandleSubmit → Random` | cross_community | 6     |
| `PlanCard → Random`     | cross_community | 4     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Categories | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
