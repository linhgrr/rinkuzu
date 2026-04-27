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

## Extend with critical paths

Add these next:

1. Auth flow: register -> login -> logout
2. Quiz flow: create -> play -> result
3. Subscription flow: start payment -> success/cancel redirects
4. Adaptive learning flow: upload -> processing -> result
