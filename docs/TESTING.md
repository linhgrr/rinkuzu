# Testing strategy

This project uses a layered test strategy:

- **Unit** (`src/**/*.test.ts`): fast logic checks, coverage-gated
- **Integration** (`tests/integration/**/*.test.ts`): module collaboration checks
- **E2E** (`tests/e2e/**/*.spec.ts`): browser-level user flow checks via Playwright

## Quality gates

Run locally before pushing:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
```

For browser checks:

```bash
npm run test:e2e:install
npm run test:e2e
```

## Coverage thresholds

Vitest enforces minimums:

- Statements: 80%
- Lines: 80%
- Functions: 80%
- Branches: 75%

## CI behavior

CI runs format, lint, unit tests (with coverage gate), integration tests, build, and e2e smoke.
