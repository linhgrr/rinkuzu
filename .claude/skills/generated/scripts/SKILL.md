---
name: scripts
description: 'Skill for the Scripts area of rinkuzu. 49 symbols across 5 files.'
---

# Scripts

49 symbols | 5 files | Cohesion: 82%

## When to Use

- Working with code in `scripts/`
- Understanding how resolveDirectoryEntry, extractCopyContent, getComplexityLevel work
- Modifying scripts-related functionality

## Key Files

| File                                   | Symbols                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `scripts/component-analyzer.mjs`       | ComponentAnalyzer, resolveDirectoryEntry, extractCopyContent, getComplexityLevel, analyze (+12) |
| `scripts/refactor-component.mjs`       | RefactorAnalyzer, RefactorPromptBuilder, showHelp, main, build (+6)                             |
| `scripts/analyze-component.mjs`        | build, buildFocusPoints, getSpecificGuidelines, TestPromptBuilder, TestReviewPromptBuilder (+4) |
| `scripts/check-internal-api-fetch.mjs` | getCallName, visit, unwrapNode, resolveObjectPropertyPrefix, resolveCommonApiPrefix (+1)        |
| `scripts/adaptive-contract.shared.mjs` | run, canRun, resolveBackendPython, exportOpenApi, lintOpenApi (+1)                              |

## Entry Points

Start here when exploring this area:

- **`resolveDirectoryEntry`** (Function) — `scripts/component-analyzer.mjs:402`
- **`extractCopyContent`** (Function) — `scripts/component-analyzer.mjs:466`
- **`getComplexityLevel`** (Function) — `scripts/component-analyzer.mjs:494`
- **`parseComplexity`** (Function) — `scripts/component-analyzer.mjs:99`
- **`listAnalyzableFiles`** (Function) — `scripts/component-analyzer.mjs:429`

## Key Symbols

| Symbol                         | Type     | File                                   | Line |
| ------------------------------ | -------- | -------------------------------------- | ---- |
| `ComponentAnalyzer`            | Class    | `scripts/component-analyzer.mjs`       | 18   |
| `resolveDirectoryEntry`        | Function | `scripts/component-analyzer.mjs`       | 402  |
| `extractCopyContent`           | Function | `scripts/component-analyzer.mjs`       | 466  |
| `getComplexityLevel`           | Function | `scripts/component-analyzer.mjs`       | 494  |
| `parseComplexity`              | Function | `scripts/component-analyzer.mjs`       | 99   |
| `listAnalyzableFiles`          | Function | `scripts/component-analyzer.mjs`       | 429  |
| `exportOpenApi`                | Function | `scripts/adaptive-contract.shared.mjs` | 68   |
| `lintOpenApi`                  | Function | `scripts/adaptive-contract.shared.mjs` | 74   |
| `generateTypes`                | Function | `scripts/adaptive-contract.shared.mjs` | 80   |
| `analyze`                      | Method   | `scripts/component-analyzer.mjs`       | 19   |
| `detectType`                   | Method   | `scripts/component-analyzer.mjs`       | 68   |
| `calculateCognitiveComplexity` | Method   | `scripts/component-analyzer.mjs`       | 97   |
| `normalizeComplexity`          | Method   | `scripts/component-analyzer.mjs`       | 198  |
| `calculateTestPriority`        | Method   | `scripts/component-analyzer.mjs`       | 361  |
| `getPriorityLevel`             | Method   | `scripts/component-analyzer.mjs`       | 386  |
| `countUsageReferences`         | Method   | `scripts/component-analyzer.mjs`       | 219  |
| `collectSearchRoots`           | Method   | `scripts/component-analyzer.mjs`       | 291  |
| `shouldSkipDir`                | Method   | `scripts/component-analyzer.mjs`       | 320  |
| `shouldInspectFile`            | Method   | `scripts/component-analyzer.mjs`       | 335  |
| `escapeRegExp`                 | Method   | `scripts/component-analyzer.mjs`       | 344  |

## How to Explore

1. `gitnexus_context({name: "resolveDirectoryEntry"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
