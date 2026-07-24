<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **rinkuzu** (10343 symbols, 24466 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource                                 | Use for                                  |
| ---------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/rinkuzu/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/rinkuzu/clusters`       | All functional areas                     |
| `gitnexus://repo/rinkuzu/processes`      | All execution flows                      |
| `gitnexus://repo/rinkuzu/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

# Git policy

- NEVER pass `--no-verify` to `git commit`, `git push`, or any other git command. Pre-commit / pre-push hooks are mandatory. If a hook fails, fix the underlying issue — do not bypass.

# Database performance

- Treat Mongoose schema indexes as the desired runtime contract, but use `npm run migrate:performance-indexes` to detect Atlas index drift.
- Run the dry-run first, then `npm run migrate:performance-indexes:apply`; the migration must remain idempotent and verify its postconditions.
- Validate changed read paths with `explain("executionStats")`; compare keys examined, documents examined, returned rows, and payload projection.

# Production quality workflow

- Before editing any function, class, or method, run GitNexus upstream impact analysis. Record direct callers, affected flows, modules, and risk; stop and warn before HIGH or CRITICAL changes.
- Before every commit, run `detect_changes({scope: "staged"})` and confirm only intended symbols/files are affected. Before handoff, run `detect_changes({scope: "compare", base_ref: "master"})`.
- Use the external-agent supervisor for parallel Grok audits and long gates. Keep read-only audits parallel, serialize writers, and have the root agent review every edit and final result. Never let an external agent touch protected user files, Gradle/cache, `.env`, live data, or Git history.
- Treat every quality artifact as evidence-bound: pin Node/npm, record commit SHA and source/config fingerprints, and fail closed when coverage, mutation, Lighthouse, contracts, or generated reports are stale, missing, or internally inconsistent. A warning threshold must remain visibly distinct from a passing gate.
- Give every CI job an explicit bounded timeout. A full-history secret gate must fetch full history and invoke a checksum-pinned scanner with an explicit all-references log scope; event-scoped action defaults must not be labelled as repository-history evidence.
- Run targeted tests for each changed boundary, then the full pre-commit gate. Never use `--no-verify`, skip a failing check, or mark an unrun gate green. Commit small validated waves frequently.
- For database changes, keep one DDL writer, run index migration dry-run before any apply, require approval for destructive/unique/TTL changes, and validate changed reads with real `executionStats` when the environment is available. Report unavailable live validation separately.
- Preserve unrelated worktree changes and the protected files listed in the task scope. Do not modify login/signup visuals, landing visuals, Android/Gradle files, or user-owned generated evidence unless explicitly requested.
- For production handoff, report passing gates, intentional blockers, stale/external evidence, unverified live checks, changed files, and exact commands. Never claim production-ready while a required guard is externally missing or red.
