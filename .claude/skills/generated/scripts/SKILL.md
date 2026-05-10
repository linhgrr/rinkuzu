---
name: scripts
description: 'Skill for the Scripts area of rinkuzu. 47 symbols across 7 files.'
---

# Scripts

47 symbols | 7 files | Cohesion: 79%

## When to Use

- Working with code in `scripts/`
- Understanding how PATCH, POST, resolveDirectoryEntry work
- Modifying scripts-related functionality

## Key Files

| File                                  | Symbols                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `scripts/component-analyzer.mjs`      | ComponentAnalyzer, resolveDirectoryEntry, extractCopyContent, getComplexityLevel, analyze (+12) |
| `scripts/refactor-component.mjs`      | RefactorAnalyzer, RefactorPromptBuilder, showHelp, main, build (+6)                             |
| `scripts/analyze-component.mjs`       | build, buildFocusPoints, getSpecificGuidelines, TestPromptBuilder, TestReviewPromptBuilder (+4) |
| `src/scripts/migratePlanDurations.js` | connectDB, migratePlanDurations, dryRunMigration                                                |
| `src/scripts/seedPlansWithISO8601.js` | connectDB, seedPlans, validatePlans                                                             |
| `src/types/subscription.ts`           | fromLegacyDuration, isValidISO8601Duration                                                      |
| `src/app/api/admin/plans/route.ts`    | PATCH, POST                                                                                     |

## Entry Points

Start here when exploring this area:

- **`PATCH`** (Function) — `src/app/api/admin/plans/route.ts:26`
- **`POST`** (Function) — `src/app/api/admin/plans/route.ts:91`
- **`resolveDirectoryEntry`** (Function) — `scripts/component-analyzer.mjs:402`
- **`extractCopyContent`** (Function) — `scripts/component-analyzer.mjs:466`
- **`getComplexityLevel`** (Function) — `scripts/component-analyzer.mjs:494`

## Key Symbols

| Symbol                         | Type     | File                               | Line |
| ------------------------------ | -------- | ---------------------------------- | ---- |
| `ComponentAnalyzer`            | Class    | `scripts/component-analyzer.mjs`   | 18   |
| `PATCH`                        | Function | `src/app/api/admin/plans/route.ts` | 26   |
| `POST`                         | Function | `src/app/api/admin/plans/route.ts` | 91   |
| `resolveDirectoryEntry`        | Function | `scripts/component-analyzer.mjs`   | 402  |
| `extractCopyContent`           | Function | `scripts/component-analyzer.mjs`   | 466  |
| `getComplexityLevel`           | Function | `scripts/component-analyzer.mjs`   | 494  |
| `parseComplexity`              | Function | `scripts/component-analyzer.mjs`   | 99   |
| `listAnalyzableFiles`          | Function | `scripts/component-analyzer.mjs`   | 429  |
| `fromLegacyDuration`           | Method   | `src/types/subscription.ts`        | 122  |
| `isValidISO8601Duration`       | Method   | `src/types/subscription.ts`        | 138  |
| `analyze`                      | Method   | `scripts/component-analyzer.mjs`   | 19   |
| `detectType`                   | Method   | `scripts/component-analyzer.mjs`   | 68   |
| `calculateCognitiveComplexity` | Method   | `scripts/component-analyzer.mjs`   | 97   |
| `normalizeComplexity`          | Method   | `scripts/component-analyzer.mjs`   | 198  |
| `calculateTestPriority`        | Method   | `scripts/component-analyzer.mjs`   | 361  |
| `getPriorityLevel`             | Method   | `scripts/component-analyzer.mjs`   | 386  |
| `countUsageReferences`         | Method   | `scripts/component-analyzer.mjs`   | 219  |
| `collectSearchRoots`           | Method   | `scripts/component-analyzer.mjs`   | 291  |
| `shouldSkipDir`                | Method   | `scripts/component-analyzer.mjs`   | 320  |
| `shouldInspectFile`            | Method   | `scripts/component-analyzer.mjs`   | 335  |

## Connected Areas

| Area         | Connections |
| ------------ | ----------- |
| Repositories | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "PATCH"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
