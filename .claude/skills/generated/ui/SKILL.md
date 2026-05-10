---
name: ui
description: 'Skill for the Ui area of rinkuzu. 30 symbols across 13 files.'
---

# Ui

30 symbols | 13 files | Cohesion: 94%

## When to Use

- Working with code in `src/`
- Understanding how cn, UserProfileLink, getUserDisplayName work
- Modifying ui-related functionality

## Key Files

| File                                               | Symbols                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/components/ui/StatsModal.tsx`                 | StatsModal, handleSortChange, formatDate, renderCategoryItem, renderCreatorItem (+3) |
| `src/components/ui/sparkles-text.tsx`              | SparklesText, initializeStars, generateStar, updateStars                             |
| `src/components/user/UserAvatar.tsx`               | getUserDisplayName, getUserInitial, UserAvatar                                       |
| `src/components/ui/MarkdownRenderer.tsx`           | normalizeLatexEscapes, MarkdownRenderer                                              |
| `src/app/[locale]/users/[userId]/page.tsx`         | getCategoryBadgeVariant, PublicUserProfilePage                                       |
| `src/features/dashboard/components/LevelBadge.tsx` | LevelBadge, random                                                                   |
| `src/app/[locale]/(app)/quiz/[slug]/page.tsx`      | shuffleArray, createQuizPlayerData                                                   |
| `src/components/ui/Pagination.tsx`                 | Pagination, getVisiblePages                                                          |
| `src/lib/utils.ts`                                 | cn                                                                                   |
| `src/components/user/UserProfileLink.tsx`          | UserProfileLink                                                                      |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `src/lib/utils.ts:3`
- **`UserProfileLink`** (Function) — `src/components/user/UserProfileLink.tsx:12`
- **`getUserDisplayName`** (Function) — `src/components/user/UserAvatar.tsx:11`
- **`getUserInitial`** (Function) — `src/components/user/UserAvatar.tsx:25`
- **`UserAvatar`** (Function) — `src/components/user/UserAvatar.tsx:35`

## Key Symbols

| Symbol                  | Type     | File                                               | Line |
| ----------------------- | -------- | -------------------------------------------------- | ---- |
| `cn`                    | Function | `src/lib/utils.ts`                                 | 3    |
| `UserProfileLink`       | Function | `src/components/user/UserProfileLink.tsx`          | 12   |
| `getUserDisplayName`    | Function | `src/components/user/UserAvatar.tsx`               | 11   |
| `getUserInitial`        | Function | `src/components/user/UserAvatar.tsx`               | 25   |
| `UserAvatar`            | Function | `src/components/user/UserAvatar.tsx`               | 35   |
| `TextShimmer`           | Function | `src/components/ui/text-shimmer.tsx`               | 8    |
| `Modal`                 | Function | `src/components/ui/Modal.tsx`                      | 17   |
| `MarkdownRenderer`      | Function | `src/components/ui/MarkdownRenderer.tsx`           | 34   |
| `PublicUserProfilePage` | Function | `src/app/[locale]/users/[userId]/page.tsx`         | 47   |
| `StatsModal`            | Function | `src/components/ui/StatsModal.tsx`                 | 28   |
| `handleSortChange`      | Function | `src/components/ui/StatsModal.tsx`                 | 125  |
| `formatDate`            | Function | `src/components/ui/StatsModal.tsx`                 | 134  |
| `renderCategoryItem`    | Function | `src/components/ui/StatsModal.tsx`                 | 144  |
| `renderCreatorItem`     | Function | `src/components/ui/StatsModal.tsx`                 | 178  |
| `renderActivityItem`    | Function | `src/components/ui/StatsModal.tsx`                 | 221  |
| `renderContent`         | Function | `src/components/ui/StatsModal.tsx`                 | 344  |
| `getSortOptions`        | Function | `src/components/ui/StatsModal.tsx`                 | 390  |
| `getRandomEmotion`      | Function | `src/shared/utils/constants.ts`                    | 13   |
| `LevelBadge`            | Function | `src/features/dashboard/components/LevelBadge.tsx` | 7    |
| `random`                | Function | `src/features/dashboard/components/LevelBadge.tsx` | 12   |

## Execution Flows

| Flow                      | Type            | Steps |
| ------------------------- | --------------- | ----- |
| `StatsModal → FormatDate` | intra_community | 4     |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
