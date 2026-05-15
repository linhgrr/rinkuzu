<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **rinkuzu** (6356 symbols, 11557 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                 | Use for                                  |
| ---------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/rinkuzu/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/rinkuzu/clusters`       | All functional areas                     |
| `gitnexus://repo/rinkuzu/processes`      | All execution flows                      |
| `gitnexus://repo/rinkuzu/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                            | Read this skill file                                        |
| ----------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?"    | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"     | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"                | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor             | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference              | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands         | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |
| Work in the Quiz area (109 symbols)             | `.claude/skills/generated/quiz/SKILL.md`                    |
| Work in the Repositories area (80 symbols)      | `.claude/skills/generated/repositories/SKILL.md`            |
| Work in the Components area (79 symbols)        | `.claude/skills/generated/components/SKILL.md`              |
| Work in the Hooks area (77 symbols)             | `.claude/skills/generated/hooks/SKILL.md`                   |
| Work in the Adaptive-learning area (54 symbols) | `.claude/skills/generated/adaptive-learning/SKILL.md`       |
| Work in the Scripts area (49 symbols)           | `.claude/skills/generated/scripts/SKILL.md`                 |
| Work in the Categories area (47 symbols)        | `.claude/skills/generated/categories/SKILL.md`              |
| Work in the Ui area (41 symbols)                | `.claude/skills/generated/ui/SKILL.md`                      |
| Work in the [slug] area (35 symbols)            | `.claude/skills/generated/slug/SKILL.md`                    |
| Work in the Subscription area (28 symbols)      | `.claude/skills/generated/subscription/SKILL.md`            |
| Work in the Llm area (27 symbols)               | `.claude/skills/generated/llm/SKILL.md`                     |
| Work in the Plans area (24 symbols)             | `.claude/skills/generated/plans/SKILL.md`                   |
| Work in the Result area (18 symbols)            | `.claude/skills/generated/result/SKILL.md`                  |
| Work in the App area (14 symbols)               | `.claude/skills/generated/app/SKILL.md`                     |
| Work in the Users area (14 symbols)             | `.claude/skills/generated/users/SKILL.md`                   |
| Work in the Routing area (13 symbols)           | `.claude/skills/generated/routing/SKILL.md`                 |
| Work in the Auth area (13 symbols)              | `.claude/skills/generated/auth/SKILL.md`                    |
| Work in the Category area (12 symbols)          | `.claude/skills/generated/category/SKILL.md`                |
| Work in the User area (12 symbols)              | `.claude/skills/generated/user/SKILL.md`                    |
| Work in the Ai area (11 symbols)                | `.claude/skills/generated/ai/SKILL.md`                      |

<!-- gitnexus:end -->
