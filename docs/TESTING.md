# Testing strategy

This project uses a layered test strategy:

- **Unit** (`src/**/*.test.ts`): fast logic checks, coverage-gated. `npm run test:unit`
  runs two Vitest projects — `vitest.node.config.ts` and `vitest.component.config.ts` —
  and writes the coverage artefacts the gate reads.
- **Quality** (`tests/quality/**/*.test.ts`): meta-tests over the guard scripts in
  `scripts/`. A guard with no meta-test is a guard nobody has proved fires.
- **Integration** (`tests/integration/**/*.test.ts`): module collaboration against a
  real MongoDB, including real transactions.
- **E2E** (`tests/e2e/**/*.spec.ts`): browser-level user flow checks via Playwright.

## Quality gates

Run locally before pushing:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run check:coverage
npm run test:quality
npm run test:integration
```

For browser checks:

```bash
npm run test:e2e:install
npm run test:e2e
```

## Coverage gates

**Vitest enforces no thresholds.** No Vitest config in this repository declares a
`thresholds` block; the gate is `scripts/check-coverage-gates.mjs`, run as
`npm run check:coverage` after `npm run test:unit` has produced
`coverage/coverage-final.json` and `coverage/lcov.info`. Its policy lives in
`quality/critical-coverage-paths.json` and has three independent parts:

| Part                | Applies to                                 | Rule                                                                     |
| ------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `thresholds`        | the 21 globs in `globs` (auth, billing, …) | 75% lines / 75% statements / 75% functions / 60% branches                |
| `changedThresholds` | lines you changed inside those same globs  | 85% lines / 85% statements / 85% functions / 75% branches                |
| `globalBaseline`    | every executable source file               | a ratchet: neither the covered **count** nor the **percentage** may fall |

The global part is a ratchet rather than a fixed floor, so it only ever moves up.
It is stored as covered/total pairs, and the percentage floor is derived from them.

### Re-cutting the baseline

Two situations require editing `globalBaseline.metrics`, and both belong in the same
commit as the change that caused them:

- **Coverage rose.** Re-cut so the new floor is the new reality. A baseline left
  behind stops protecting anything: this one sat at 20.9% lines against a real 50.9%
  until 2026-08-30, which meant coverage could have fallen thirty points with the gate
  still reporting "passed".
- **Covered code was deleted.** Removing tested code lowers the absolute covered count
  while the percentage holds or rises, and the count guard fires. Re-cut only after
  confirming all four percentages are unchanged or higher — that check is what
  separates a legitimate deletion from a real regression.

Regenerate the numbers with `npm run test:unit` followed by `npm run check:coverage`;
the failure message names the exact counts to write.

## CI behavior

CI runs format, lint (which fronts the architecture and guard scripts), typecheck,
route-param safety, duplication, unit tests with the coverage gate, quality tests,
integration tests, mutation, build, and e2e smoke. Every job carries an explicit
`timeout-minutes`.

One gate is knowingly partial: `check:api-error-codes` verifies the frontend half of
the error-code contract and reports `PARTIAL` for the cross-repo drift half, which
needs a `rinkuzu-ai-api` checkout beside this one. Setting
`REQUIRE_BACKEND_CONTRACT=1` turns that skip into a failure; CI does not set it yet,
because checking out a sibling repository needs a token this repository does not carry.
