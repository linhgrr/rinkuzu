# E2E tests (Playwright)

Playwright is configured in `playwright.config.ts`.

## Commands

- `npm run test:e2e:install`: install Chromium + system deps
- `npm run test:e2e`: run all e2e tests headless
- `npm run test:e2e:headed`: run headed mode
- `npm run test:e2e:ui`: interactive runner

## Current suite

- `smoke.spec.ts`
  - `/en/about` page load check
  - `/robots.txt` endpoint check
- `critical-flows.spec.ts`
  - `@critical-auth`: real credentials session, persistence, role guard, and logout
  - `@critical-quiz`: seeded quiz, answer, persisted attempt, and result page
  - `@critical-starter`: new learner sees the starter quiz block above the fold and opens question 1
  - `@critical-adaptive`: upload UI, processing state, and generated subject page
  - `@critical-subscription`: checkout handoff plus success/cancel outcomes
  - `@critical-admin`: admin route/API access and a persisted role mutation
  - `@critical-admin-quiz-visibility`: admin makes a public quiz private (anonymous play 401, gone from the public list), the change is audited, and the same row makes it public again
  - `@critical-admin-disable`: admin disable/restore, authVersion session revocation, disabled/active filters, fresh login after restore

Fixture users are seeded with the canonical disable contract
(`disable: 0`, `authVersion: 0`, `disabledAt: null`, `disabledBy: null`) so
active-status filters and session checks behave exactly as production.

Critical flows write only to a local MongoDB database named `rinkuzu_ci`. The
suite fails closed for every other host or database name. Seeded rows and
derived attempt/progress/audit rows are removed after each test, and cleanup
postconditions are verified.

The production app and Mongo-backed boundaries run for real. Playwright starts
`support/fake-adaptive-server.mjs` for the unavailable adaptive service; object
storage and PayOS are intercepted at their external boundaries so the suite
cannot upload or create a real payment.
