# RIN-8 web beta release evidence package

Status: prepared for human review; **not approved or published**. Evidence was collected
on 2026-08-13 (Asia/Saigon) without production credentials, deployment, traffic changes,
spend, or user contact.

## Candidate and scope

- Candidate branch: `fix/rin-28-owned-web-claims`
- Candidate commit: `66f4281e7e509bc21a94cf59988c63e3bd178e23`
- Remote baseline: `origin/master` at
  `cab1d54afcc1e343cdc1112144669aeef1a5ce81`
- Candidate relation: one local commit ahead of `origin/master`; the candidate branch was
  not pushed or deployed by this audit.
- Source delta: nine files (localized landing copy, marketing/about/blog/FAQ pages,
  `llms.txt`, and the owned-web claims test). GitNexus comparison with `origin/master`
  reports 12 changed symbols, zero affected execution flows, and LOW risk.
- Local-ref caveat: local `master` is stale at
  `24300c65eb70b3cad219408cfb4974d5ac82204f`; release comparison and rollback must use
  fetched `origin/master`, not local `master`.

The proposed beta outcome is the existing consented activation slice: a visitor can
authenticate, upload a PDF, and complete a quiz, while the application emits the
approved `$pageview -> login_completed -> pdf_upload_completed -> quiz_completed`
funnel without intentionally adding prohibited personal or document data. The candidate
commit adds no new product capability; it removes unsupported public claims from the
same web delivery surface. This package does not claim real-user outcome evidence.

## Passing local gates

Environment: Windows, Node.js `22.23.1`, npm `10.9.8`, lockfile SHA-256
`62669E4EF125533EC5293ECF77B01A2241E81624EA998681BD96B06BF01E3867`.

| Gate                                               | Command                                                                                                                                                                                                                                                                       | Result                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Pinned runtime                                     | `npm run check:node`                                                                                                                                                                                                                                                          | PASS                                                  |
| Route parameter safety                             | `npm run check:routes`                                                                                                                                                                                                                                                        | PASS                                                  |
| Application types                                  | `npm run typecheck`                                                                                                                                                                                                                                                           | PASS                                                  |
| Script types                                       | `npm run typecheck:scripts`                                                                                                                                                                                                                                                   | PASS                                                  |
| Focused reliability/instrumentation/PWA/copy tests | `npx vitest run src/lib/analytics/client.test.ts src/components/analytics/AnalyticsIdentity.test.tsx src/features/auth/components/LoginForm.test.tsx src/features/auth/components/GoogleAuthButton.test.tsx tests/pwa-runtime-caching.test.ts tests/owned-web-claims.test.ts` | PASS: 6 files, 32 tests                               |
| Graph scope                                        | `node .gitnexus/run.cjs detect-changes -r rinkuzu --scope compare --base-ref origin/master`                                                                                                                                                                                   | PASS: LOW risk, 9 files, 12 symbols, 0 affected flows |

The focused tests cover analytics consent gating and property sanitization, login identity
continuity for credential and Google paths, one-time pending markers, PWA runtime caching,
and the candidate's supported-claims contract. They do not replace a browser journey or
live integration check.

## Instrumentation evidence

- The approved event and privacy contract is
  `docs/analytics/activation-event-contract.md`.
- GitNexus context for `captureAnalyticsEvent` identifies direct callers at login,
  registration, PDF upload, adaptive answer submission, and quiz completion boundaries.
  It participates in `AdaptiveLearningExercise -> SanitizeProperties` and
  `HandleSubmit -> IsBrowser` flows.
- Repository tests emitted no production events and used no vendor credentials.
- Historical live schema inspection recorded in the contract confirms the funnel event
  names existed in PostHog project `525510` as of 2026-08-11, but sparse traffic and
  identity/order discontinuity mean it is not beta-conversion evidence.

## Unresolved evidence and risks

These items are **not passing gates**:

1. Production-mode `npm run build` with synthetic, non-secret configuration exceeded
   the bounded 180-second audit window. No exit result was obtained, so build
   reproducibility at this candidate is unverified.
2. Because a completed release build was unavailable, the local standalone server,
   `/manifest.json`, `/serwist/sw.js`, installability, and browser smoke checks were not
   run at this commit.
3. Responsive behavior was not browser-verified at desktop, Pixel 5, and iPhone 13
   viewports. Playwright defines those projects, but critical quiz/adaptive E2E depends
   on a completed build and test MongoDB fixture.
4. Authentication, MongoDB, object storage, adaptive API, mail, billing, OAuth, and
   analytics vendor integrations were not exercised. Production credentials remain
   human-gated.
5. The full mandatory `prepush:full` gate was not run in this audit. The focused gates
   above cannot support a release decision by themselves.
6. The candidate branch/commit is local and is not an immutable remote release ref.
   A human must decide whether the unrelated owned-web copy correction belongs in the
   beta candidate or whether `origin/master` should be nominated instead.

## Rollback plan

The rollback target before any later promotion is the last known remote baseline,
`cab1d54afcc1e343cdc1112144669aeef1a5ce81`. Before release, the human owner must replace
that value with the actual last-known-good deployed SHA if production differs.

Testable, non-destructive procedure:

1. Fetch `origin/master` and verify both the candidate and last-known-good objects with
   `git cat-file -e <sha>^{commit}`.
2. Inspect the complete candidate range with
   `git log --oneline <last-known-good>..<candidate>` and
   `git diff --check <last-known-good>..<candidate>`.
3. Record the currently deployed immutable SHA and environment revision before promotion.
4. If rollback is required, have the human deployment owner redeploy the recorded
   last-known-good SHA with its previously approved environment. Do not reset, rewrite,
   or force-push Git history.
5. Re-run landing, sign-in/sign-up render, approved upload/quiz outcome, analytics
   consent, `/manifest.json`, and `/serwist/sw.js` smoke checks at desktop and narrow
   mobile widths. Record the recovered deployed SHA and residual impact.
6. Treat database repair, migrations, credential rotation, destructive/unique/TTL index
   changes, and client cache eviction as separate approval-gated procedures.

## Exact human web release checklist

- [ ] Decide the candidate: include local `66f4281e...` or nominate fetched
      `origin/master` `cab1d54a...`; do not mix evidence between SHAs.
- [ ] Fetch `origin/master`; confirm a fast-forward-only outgoing commit list and complete
      diff, with no unrelated user work discarded.
- [ ] Pin Node `22.23.1`, npm `10.9.8`, and lockfile hash shown above.
- [ ] Supply the approved release-candidate environment through the deployment platform;
      do not print or commit secret values.
- [ ] Complete `npm ci`, `npm run prepush:full`, and a bounded production `npm run build`.
- [ ] Start the exact standalone build and smoke-test canonical landing, sign-in, and
      sign-up routes without changing their approved visuals.
- [ ] Run the approved authenticate -> PDF upload -> quiz completion journey and its
      upload failure path against approved non-production dependencies.
- [ ] Verify desktop, Pixel 5, and iPhone 13 layouts have no clipped primary actions,
      inaccessible controls, or horizontal page overflow; retain screenshots/results.
- [ ] Verify `/manifest.json` and `/serwist/sw.js` return successfully and browser
      installability is healthy.
- [ ] With consent granted in an approved non-production analytics project, verify the
      ordered event names and allowed properties; with consent denied, verify no capture.
- [ ] Confirm the last-known-good deployed SHA, environment revision, rollback operator,
      and post-rollback smoke owner.
- [ ] Review unresolved external integrations, data/privacy retention, and operational
      risks separately from passing repository gates.
- [ ] Obtain explicit human go approval before any push/promotion, production credential
      use, deployment, traffic change, spend, release publication, or user contact.
- [ ] After deployment, record the deployed SHA and live smoke evidence. A local pass or
      commit alone is not release completion.

## Current recommendation

**NO-GO pending evidence**, not a product rejection. The human release owner should not
promote this candidate until the bounded production build, mandatory pre-push gate,
responsive browser matrix, approved user journey, manifest/service-worker checks, and
rollback target confirmation are complete.
