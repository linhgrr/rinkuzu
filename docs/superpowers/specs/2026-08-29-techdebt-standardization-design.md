# Tech-Debt Standardization — Design

Date: 2026-08-29
Status: approved scope, pending user review of this spec
Branch: `techdeb` (worktree), base `master`

## Goal

Retire the structural tech debt found by the 2026-08-29 audit so the codebase is easier to extend, maintain, and keep stable. Behavior-preserving throughout: no feature changes, no visual changes, no schema/DDL changes.

## Audit evidence (2026-08-29)

Already healthy — out of scope, must not regress:

- DIP: services import zero concrete repositories; DI via constructor interfaces, composition in `src/lib/*-factory.ts`.
- Route handlers: `withAdmin`/`withAuth` HOFs, zod validation, `apiOk`/`apiErr` envelope — consistent across 147 routes.
- Server pages call services directly through factories (correct RSC data flow).
- 0 runtime import cycles (1,000 files), `check:source-of-truth` OK, 8 debt markers total, empty layer-boundary allowlists, knip near-clean (12 unused exports, 33 unused types).
- The 2026-08-24 dual-authority entitlement finding was resolved by the 2026-08-25 cutover; not open debt.

Open debt:

1. **God modules (SRP/ISP).** `src/lib/communication/service.ts` (2,858 lines, 28 exports, 4 domains: support, feedback, campaigns, worker/webhook/health; 10 internal clone pairs). `src/repositories/BillingRepository.ts` (2,432 lines, 40 methods, one class). `src/services/premium/PremiumQuizService.ts` (859 lines, 4 internal clone pairs).
2. **Client-page monoliths (Next.js).** 18 of 70 pages are fully `'use client'` (all 10 admin pages plus explore, history/[attemptId], premium-quizzes, quiz/[slug]/flashcards, quiz/[slug]/result, quizzes, review, subscription), 600–1,100 LOC each. Only 9 `loading.tsx` and 2 `error.tsx` across 70 pages. Two competing client-fetch idioms: SWR (24 files) vs manual `useEffect`+fetch (32 files).
3. **Duplication gate RED.** `check:duplication` fails with 54 new clones (61 total, 1.17%): (a) route param/body validation preamble repeated across ~20 routes; (b) god-file internal clones; (c) layer-shape triplication — same shape hand-declared in `dtos/`, `entities/`, `repositories/types/` (admin-billing-orders, premium-play-session, quiz vs quiz-draft) plus near-identical mapper pairs; (d) `auth-rate-limit.ts` ↔ `billing-rate-limit.ts` twins.
4. **No size/complexity guardrails.** ESLint has no `max-lines`/`complexity` rules, so god files can regrow.
5. **Naming-boundary smell (observation only).** `features/quiz` vs `features/quizzes`, `features/subscription` vs `features/billing`. Not in scope to merge; Wave 3 must not worsen it.

## Non-goals

- No layer collapse: the 8-layer architecture (`entities`/`dtos`/`mappers`/`interfaces`/`models`/`repositories`/`services`/`features`) and `check:architecture` guard stay.
- No visual changes anywhere (extends the CLAUDE.md protection of login/signup/landing to every page: structure-only refactors, DOM/classes identical).
- No database DDL, no index changes, no data migrations.
- No dependency upgrades.
- No merging of `features/quiz`/`quizzes` or `subscription`/`billing`.

## Plan — four waves, risk-ascending

Each wave lands as its own commit series; a wave starts only after the previous wave's gates are green.

### Wave 1 — Duplication + guardrails (low risk)

1. Add a validated-route helper on top of the existing primitives (`readAndValidateRouteParams`, `readAndValidateJson`, `apiErr`): a wrapper taking `{ paramsSchema?, bodySchema? }` that yields parsed values to the handler and emits the standard `validation_error` responses. Apply to the ~20 flagged routes (admin campaigns/feedback/support, premium-quiz sessions, credits, internal billing). No response-shape changes.
2. Merge `src/lib/auth-rate-limit.ts` and `src/lib/billing-rate-limit.ts` into one parameterized core; keep both public entry points/config values.
3. Remove intra-file clones in `src/dtos/communication.ts` and `src/models/Communication.ts` via local extraction.
4. ESLint guardrails: `max-lines` (warn 500 / error 800) and `complexity` for new code; existing oversized files go into a frozen allowlist that may only shrink.

Gate: `check:duplication` green (no new clones; total count strictly down), `typecheck`, `lint`, `test:node`, `test:component` green.

### Wave 2 — Split god modules (medium risk)

1. `src/lib/communication/service.ts` → `src/lib/communication/support.ts`, `feedback.ts`, `campaigns.ts`, `worker.ts` (worker + webhook + health), shared internals in `internal.ts`. All 28 exports keep names and signatures; callers switch to direct imports. No barrel file (re-export-only modules are banned by `check:architecture`). The 10 internal clone pairs collapse into shared internals during the move.
2. `src/repositories/BillingRepository.ts` → facade + four internal collaborators (quote, order, fulfillment, reconcile). `IBillingRepository` and every caller stay untouched; mirrors the existing `QuizService` facade pattern. **Decision: facade, not interface split** (user-approved).
3. `PremiumQuizService.ts`: extract the 4 internal clone pairs into private helpers; no public API change.

Protocol: GitNexus `impact({target, direction: "upstream"})` before cutting each symbol; stop and warn on HIGH/CRITICAL. `rename` tool for any symbol renames. Behavior-preserving: existing tests must pass unmodified except for import paths.

Gate: Wave 1 gates + `detect_changes({scope: "staged"})` shows only intended symbols.

### Wave 3 — Standardize the 18 client pages (medium-high risk)

**Decision: all 18 pages** (user-approved). Order: 10 admin pages first, then the 8 app pages.

Per page: `page.tsx` becomes a thin server component (auth/session, metadata, Suspense boundary); the interactive body moves to a client component under the owning `src/features/*/components/`. Unify client fetching on SWR where the page already fetches client-side (do not convert client fetching to server fetching where polling/mutation UX depends on it). Add `loading.tsx`/`error.tsx` coverage for the main route groups.

Hard constraint: rendered DOM/classes identical — structure-only. Any page that cannot be split 1:1 is reported and skipped, not forced.

Gate: Wave 1 gates + `test:e2e` for touched flows where runnable; per-page visual parity check.

### Wave 4 — Derive layer shapes (architecture decision, user-approved)

Keep all layers; kill the triple declaration. Entity is the single source of a shape:

- `src/shared/types/derive.ts`: `Serialized<T>` (Date→string recursively) and `Persisted<T, IdKey>` (`id: string` → `_id: Types.ObjectId`, Date preserved) mapped-type utilities. Note: `Persisted` output references mongoose types, so persistence aliases stay declared inside `src/repositories/types/` applying the utility — layer guard remains satisfied.
- Apply to the three flagged clusters first: admin-billing-orders, premium-play-session, quiz/quiz-draft shared question shapes. Runtime mappers remain (conversion is real work); only the type declarations derive.
- Rollout is incremental: future edits standardize the file they touch; no big-bang rewrite of all 43 DTO files.

Gate: Wave 1 gates + `check:architecture` + `check:source-of-truth` green.

## Verification & handoff

- Every commit: `precommit:fast` hooks run naturally (never `--no-verify`); `detect_changes({scope: "staged"})` before each commit.
- End of each wave: `typecheck`, `typecheck:scripts`, `lint`, `test:node`, `test:component`, `check:duplication`.
- Final handoff: `detect_changes({scope: "compare", base_ref: "master"})`, `prepush:full`, and a report of passing gates, skipped items, and anything unverifiable locally (`audit:consistency` needs `MONGODB_URI`; live DB checks are out of scope here and reported as not run).

## Risks

- Communication split touches every communication route's imports — mitigated by signature-preserving moves and the existing route tests.
- Billing is the most sensitive domain — mitigated by the facade choice (zero caller churn) and GitNexus impact gating.
- Page splits can drift DOM subtly — mitigated by 1:1 constraint, e2e on touched flows, and skip-and-report rule.
- `Serialized<T>` mapped types can produce unreadable hover types — mitigated by applying only where triplication exists today.
