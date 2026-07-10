# Full Project Performance Audit

Date: 2026-07-10

## Scope

- Frontend: public landing, auth, quiz play, dashboard/data access, and Personal Learning UI.
- Backend: readiness, pipeline job polling, persistence projections, and startup behavior.
- Local Personal Learning used real persisted data with read-only requests.
- Deploy checks were limited to public landing/login because the deployed HF Space is unavailable.
- No PDF upload, OCR, PDF processing, deletion, payment, password, profile, or webhook mutation was run.

## Executive Summary

The main data-access paths do not show a systemic N+1 pattern. Quiz, folder, dashboard, attempt detail, and discussion lists already use aggregation, `$lookup`, `bulkWrite`, projections, or parallel count queries. The largest confirmed backend hot-path problem was pipeline polling loading the complete result including embeddings on every request.

The audit fixed the unsafe PWA cache policy, compacted pipeline polling, moved quiz bootstrap to the server, stopped model initialization in read-only backend mode, corrected the performance harness, and reduced five critical image assets from about 13.5 MB to about 356 KB. Frontend performance is improved but not yet within the current Lighthouse LCP/TTI budgets.

## Audit Health Score

This is an automated/static score, not a WCAG certification.

| Dimension         |     Score | Evidence                                                                                                                    |
| ----------------- | --------: | --------------------------------------------------------------------------------------------------------------------------- |
| Accessibility     |       2/4 | React Doctor still reports 14 project-wide accessibility warnings; no full keyboard/screen-reader pass was run.             |
| Performance       |       2/4 | Backend polling/readiness improved materially; landing and login still miss LCP/TTI budgets.                                |
| Responsive design |       3/4 | Existing responsive structure is broad, but no exhaustive authenticated mobile visual pass was run.                         |
| Theming           |       3/4 | Shared surface/ink tokens are used in product UI; the landing page still contains hard-coded campaign colors.               |
| Anti-patterns     |       2/4 | Unsafe PWA caching and animated gradient LCP were removed; oversized client surfaces and decorative landing effects remain. |
| **Total**         | **12/20** | **Acceptable, with P1 frontend performance work remaining.**                                                                |

## Implemented Changes

### PWA and measurement

- Removed catch-all and JSON `NetworkFirst` runtime caching. Authenticated APIs, navigations, and `/_next/image` are no longer eligible for service-worker caching.
- Runtime caching is now limited to versioned Next static assets, fonts, icons, models, and other explicitly public files.
- Lighthouse now runs three times per route against `next start`, supports a configurable port, and reports one median entry per URL.
- Bundle enforcement now calculates gzip first-load JavaScript per route instead of comparing the sum of the whole build to a route budget.

### Pipeline polling

- Default `GET /api/v1/pipeline/jobs/{job_id}` uses a compact Beanie projection and excludes `result`, `debug_trace`, and embeddings.
- `include_debug=true` is opt-in. It preserves debug artifacts and result data but replaces embeddings with `concept_embedding_count`.
- The full loader remains unchanged for create-session/exercise flows that need the complete graph payload.

### Quiz and auth

- Quiz play data now loads in the Server Component through `QuizService` instead of waiting for hydration and then calling `/api/quiz/{slug}/play` from `useEffect`.
- Resume/progress behavior remains client-side and unchanged.
- Login no longer prefetches the protected dashboard before a session exists or calls `refresh()` after `replace()`, eliminating duplicate post-auth navigation.
- The deployed 350 ms login/register panel and form transitions remain unchanged; auth motion and PNG assets were explicitly excluded from the optimization.
- Quiz desktop/mobile renderers are viewport-specific dynamic chunks. Discussion loads on first open while preserving its mounted state, and the AI transport loads only after the user submits an AI question.
- Landing texture, earth, and character assets were resized/converted to WebP. The 3.6 MB rotating page texture was replaced by a 23 KB repeating texture without the 6,295 px rotation layer.
- Removed the infinitely animated gradient hero heading and the unused client component that implemented it.

### Backend startup and load harness

- `LOAD_MODELS=false` now also skips `EmbeddingClient`/`ChunkChromaStore` initialization, so read-only readiness/load tests do not download or initialize HF models.
- Backend load testing now runs 10 VU for 60 seconds and no longer ignores failures.
- Added a reproducible read-only Mongo benchmark for full, compact, and debug pipeline payloads.

## Measurements

### Backend, real Mongo data

Thirty reads of a completed pipeline job:

| Mode                     | BSON payload |   Median |      p95 |
| ------------------------ | -----------: | -------: | -------: |
| Full document            |    334,516 B | 35.81 ms | 40.93 ms |
| Compact polling          |      6,817 B | 21.11 ms | 27.55 ms |
| Debug without embeddings |    107,221 B | 25.83 ms | 28.77 ms |

Compact polling reduced the database payload by about 98% and median query time by about 41%. Local FastAPI verification returned 200 for both modes; the normal response was 9,726 B with `result: null`, and debug returned 109,719 B with an embedding count but no embedding vectors.

### Backend load

Ten VU over 60 seconds on local read-only health/readiness:

- 775 requests, 0 failures.
- 13.13 requests/second.
- Median 3 ms, p95 5 ms, max 16 ms.

### Frontend production build

- All 56 measured routes are under the 350 KiB gzip first-load budget.
- Largest routes: login/register at 332,725 B each, with about 25 KiB headroom.
- Quiz play reduced from 349,717 B to 321,171 B gzip (8.2%), leaving 37,229 B of headroom under its 358,400 B limit.
- Homepage route reduced from 265,494 B to 251,070 B gzip after removing the animated heading client boundary.
- Final local Lighthouse medians, three runs per route:

| Route       | Score |    LCP |    TTI | CLS |
| ----------- | ----: | -----: | -----: | --: |
| `/en`       |  0.79 | 5.66 s | 5.98 s |   0 |
| `/en/login` |  0.91 | 3.40 s | 5.14 s |   0 |

Current budgets are score >= 0.80, LCP <= 2.5 s, TTI <= 3.5 s, and CLS <= 0.1. The performance budget remains advisory and correctly reports these violations.

### Public deploy smoke

- `https://rinkuzu.app/en` redirects 307 to `https://www.rinkuzu.app/en`.
- Five public homepage requests: warm TTFB 0.39-0.49 s; first cold request 2.08 s.
- Five login requests: TTFB 0.38-0.49 s.
- Authenticated login tracing showed credentials completed at about 1.73 s and the first dashboard RSC at about 2.05 s, but duplicate document/RSC navigation extended settling to about 5.35 s. The local optimized flow now performs one dashboard RSC and settles when the URL changes.
- All final responses were 200. Personal Learning deploy routes were intentionally not tested.

## Remaining Findings

### P1: Landing and auth still miss Web Vitals budgets

Landing remains a large, highly decorated client surface. The current LCP candidate is the hero character on the mobile Lighthouse viewport; TTI is also held back by landing client work. Login scores well overall but still misses the strict LCP/TTI thresholds.

Recommended next work: split below-the-fold landing sections behind server/static boundaries, remove or defer remaining decorative client motion, and profile font loading plus the app-wide provider payload. Validate each batch with three-run medians.

### P2: Quiz player needs E2E release coverage

The first-load bundle headroom issue is resolved: quiz play is now 321,171 B against a 358,400 B limit. Production-local smoke verified answer selection, viewport-specific player loading, discussion lazy loading with a read-only 200 response, and opening the AI modal without issuing an AI request.

Remaining work is to make these interactions a stable Playwright release gate, including mobile/desktop viewport coverage and chunk-load failure states.

### P1: Performance and E2E coverage are not release gates

Harness shows integration evidence for many user stories but almost no performance or E2E evidence. Lighthouse violations are advisory. Add CI artifacts and fail only on stable route medians after reducing current baseline variance.

### P2: React warnings and oversized changed surfaces

- Full React Doctor: 74/100, 248 warnings, including 15 performance warnings.
- Changed-scope React Doctor: 87/100, 23 warnings, including decorative SVG `<img>` findings and debug-page effect/memoization suggestions.
- `compactJson` in the debug page intentionally serializes to JSON-compatible data; replacing it with `structuredClone` would change semantics and is not an automatic fix.

### P2: Existing PDF/OCR test drift

Full backend pytest currently has three failures in PDF/OCR tests because mocks target removed module-level imports (`extract_document_text_from_file` / `extract_document_text_from_bytes`). These are outside this audit's explicit no-PDF test scope, but the tests should be updated before PDF pipeline work is shipped.

### P2: Framework deprecations

FastAPI reports that custom `ORJSONResponse` use is deprecated, and Starlette reports the current TestClient/httpx integration as deprecated. Neither blocked this change, but both should be scheduled before dependency upgrades make them errors.

## Anti-pattern Verdict

The product UI is not dominated by generic generated-card patterns, and the main Mongo list flows are generally well-shaped. The confirmed harmful anti-patterns were broad authenticated PWA caching, client-after-hydration quiz fetching, full-document polling with embeddings, eager RAG model startup in read-only mode, huge decorative assets, and continuous LCP animation. Those were fixed.

Remaining anti-pattern pressure is concentrated in the marketing landing page and a few oversized client components, not across the whole application architecture.

## Validation Evidence

- Frontend production build: passed, 112 routes generated.
- Frontend lint/architecture/API guards: passed.
- Frontend Vitest: 136 files, 593 tests passed.
- Adaptive OpenAPI validation and generated contract check: passed.
- Backend pre-commit: Ruff, formatting, actionlint, secret scan, file checks, and mypy passed.
- Backend targeted tests: 10 passed for pipeline status and model-disabled RAG startup.
- Full backend pytest: all but the three documented PDF/OCR test-drift failures passed.
