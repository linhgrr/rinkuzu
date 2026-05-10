<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **rinkuzu** (5995 symbols, 10601 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `gitnexus analyze --skills` in terminal first.

## Always Do

- **MUST run `gitnexus_impact` before editing any function, class, method, route handler, repository, hook, schema, or shared utility.**
- **MUST run `gitnexus_detect_changes()` after edits and before commit or handoff.**
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding.
- When the task area is unclear, start with `gitnexus_query({query: "concept or feature"})`.
- When editing a specific symbol and you do not already know its callers/callees/flows, run `gitnexus_context({name: "symbolName"})` first.
- For any **non-trivial frontend change** — auth, payment, subscription, API route, server action, adaptive-learning flow, business-logic component, or shared state/data layer — use GitNexus before editing.

## Never Do

- NEVER edit a non-trivial symbol without first running `gitnexus_impact`.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename`.
- NEVER skip `gitnexus_detect_changes()` before handoff after meaningful code changes.
- NEVER do grep-first exploration for frontend architecture questions when `gitnexus_query` or `gitnexus_context` would answer faster and more safely.
- NEVER use `--no-verify` with git commit. The pre-commit hook runs formatting, linting, type-checking, and tests. If the hook fails, fix the underlying issue instead of bypassing it.

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
| Work in the Repositories area (112 symbols)     | `.claude/skills/generated/repositories/SKILL.md`            |
| Work in the Components area (70 symbols)        | `.claude/skills/generated/components/SKILL.md`              |
| Work in the Adaptive-learning area (66 symbols) | `.claude/skills/generated/adaptive-learning/SKILL.md`       |
| Work in the Hooks area (57 symbols)             | `.claude/skills/generated/hooks/SKILL.md`                   |
| Work in the Scripts area (47 symbols)           | `.claude/skills/generated/scripts/SKILL.md`                 |
| Work in the Subscription area (33 symbols)      | `.claude/skills/generated/subscription/SKILL.md`            |
| Work in the [slug] area (31 symbols)            | `.claude/skills/generated/slug/SKILL.md`                    |
| Work in the Ui area (30 symbols)                | `.claude/skills/generated/ui/SKILL.md`                      |
| Work in the Quiz area (29 symbols)              | `.claude/skills/generated/quiz/SKILL.md`                    |
| Work in the Admin area (28 symbols)             | `.claude/skills/generated/admin/SKILL.md`                   |
| Work in the App area (19 symbols)               | `.claude/skills/generated/app/SKILL.md`                     |
| Work in the [id] area (17 symbols)              | `.claude/skills/generated/id/SKILL.md`                      |
| Work in the Result area (16 symbols)            | `.claude/skills/generated/result/SKILL.md`                  |
| Work in the Ai area (14 symbols)                | `.claude/skills/generated/ai/SKILL.md`                      |
| Work in the Plans area (14 symbols)             | `.claude/skills/generated/plans/SKILL.md`                   |
| Work in the Auth area (14 symbols)              | `.claude/skills/generated/auth/SKILL.md`                    |
| Work in the Stats area (13 symbols)             | `.claude/skills/generated/stats/SKILL.md`                   |
| Work in the Routing area (13 symbols)           | `.claude/skills/generated/routing/SKILL.md`                 |
| Work in the Payment area (12 symbols)           | `.claude/skills/generated/payment/SKILL.md`                 |
| Work in the Categories area (12 symbols)        | `.claude/skills/generated/categories/SKILL.md`              |

<!-- gitnexus:end -->
