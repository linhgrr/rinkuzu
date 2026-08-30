# Tech-Debt Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the structural debt found by the 2026-08-29 audit — duplication gate red, god modules, client-page monoliths, missing guardrails — while keeping behavior, visuals, and the three-layer architecture exactly as they are.

**Architecture:** Four risk-ascending waves. Wave 1 removes mechanical duplication and adds ESLint size/complexity guardrails. Wave 2 splits the three god modules behind unchanged public APIs. Wave 3 converts 18 fully-client pages to thin server shells + feature-owned client components and unifies client fetching on SWR. Wave 4 dedupes within the DTO layer and codifies the three-layer type standard in writing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, zod 4, mongoose 8, SWR 2, vitest 4, jscpd 5 (fingerprint-baselined), ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-08-29-techdebt-standardization-design.md`

## Global Constraints

- Node must be exactly 22.23.1 (`npm run check:node` enforces it).
- NEVER pass `--no-verify` to any git command; pre-commit hooks (`precommit:fast` + lint-staged) must pass naturally.
- Behavior-preserving throughout: no feature changes, no schema/DDL changes, no dependency upgrades, no data migrations.
- Visual-preserving throughout: rendered DOM and class names identical on every page. Never add/remove/reorder DOM nodes, never change metadata/titles.
- No re-export-only files — `check:architecture` fails on them. When moving exports, callers import the new owning module directly.
- No `as any`, `as unknown as`, `as never` anywhere in src/ or tests/ — `check:architecture` fails on them.
- Exported functions in checked boundaries need explicit return types and named (non-inline-literal) parameter/return types.
- DTO files (`src/dtos/`) must never import `@/entities/`, `@/models/`, `@/repositories/`. Feature/presentation client files must not import `@/dtos/` or call `fetch(`/`fetchApi*` directly.
- GitNexus protocol: before cutting any function/class/method, run impact analysis (MCP tool `impact({target, direction: "upstream"})` if available, else `node .gitnexus/run.cjs impact <symbol>` from repo root). Record blast radius in the commit body. If HIGH or CRITICAL: stop and report to the user before proceeding.
- Before each commit: run `detect_changes({scope: "staged"})` (MCP) when available and confirm only intended symbols changed.
- Commit style: conventional commits with scope, e.g. `refactor(communication): …`, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Test commands: `npm run test:node` (node env, `src/**/*.test.ts` + `tests/**` minus e2e/integration/quality), `npm run test:component` (jsdom, `*.test.tssx`), `npm run test:quality` (gate self-tests). Vitest single file: `npx vitest run --config vitest.node.config.ts <path>`.
- Gate state after the 2026-08-30 rebase onto master: `typecheck`, `lint`, `test:node`, `check:architecture` and `check:dead-code` are GREEN and must stay green. `check:duplication` is red ONLY because 16 baseline fingerprints went stale when Task 1.2 removed clones — the totals moved DOWN (52 clones / 524 lines vs master's ceiling of 58 / 582); Task 1.7 re-cuts it. `audit:consistency` needs `MONGODB_URI` and is out of scope — report as not run, never as passed.

---

## Wave 1 — Duplication + guardrails

### Task 1.1: Duplication-baseline ratchet script

The gate (`scripts/check-duplication.mjs`) compares content-hash fingerprints of every clone against `quality/duplication-baseline.json` → `knownCloneFingerprints`. Any edit to a file containing a known clone changes its fingerprint, so every wave that removes clones must re-ratchet the baseline. There is currently no tool for that — build it first.

**Files:**

- Create: `scripts/update-duplication-baseline.mjs`
- Modify: `package.json` (add script `"baseline:duplication": "node scripts/update-duplication-baseline.mjs"`)
- Test: `tests/quality/update-duplication-baseline.test.ts`

**Interfaces:**

- Consumes: `fingerprintDuplicate(root, duplicate)`, `isImportOnlyDuplicate(root, duplicate)` — already exported by `scripts/check-duplication.mjs`.
- Produces: CLI `npm run baseline:duplication` (dry-run: prints clone list + totals) and `npm run baseline:duplication -- --apply` (rewrites baseline). Refuses to raise any ceiling — ratchet-down only. Never touches `limits.percentage` or `minimumAnalyzedSources` (they are cross-validated against `.jscpd.json`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/quality/update-duplication-baseline.test.ts
import { describe, expect, it } from 'vitest';
import { buildRatchetedBaseline } from '../../scripts/update-duplication-baseline.mjs';

const baseline = {
  schemaVersion: 1,
  minimumAnalyzedSources: 425,
  detector: {
    name: 'jscpd',
    version: '5.0.12',
    mode: 'mild',
    minLines: 5,
    minTokens: 50,
    maxSize: '10mb',
  },
  scope: { paths: ['src'], formats: ['typescript', 'javascript'], ignore: [] },
  limits: { clones: 68, duplicatedLines: 687, percentage: 2.2 },
  knownCloneFingerprints: ['old-a', 'old-b'],
};

describe('buildRatchetedBaseline', () => {
  it('replaces fingerprints and lowers ceilings to the fresh totals', () => {
    const next = buildRatchetedBaseline(baseline, {
      fingerprints: ['b-new', 'a-new'],
      totals: { clones: 10, duplicatedLines: 100, percentage: 0.5 },
    });
    expect(next.knownCloneFingerprints).toEqual(['a-new', 'b-new']);
    expect(next.limits).toEqual({ clones: 10, duplicatedLines: 100, percentage: 2.2 });
    expect(next.minimumAnalyzedSources).toBe(425);
  });

  it('refuses to ratchet up', () => {
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x'],
        totals: { clones: 69, duplicatedLines: 100, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x'],
        totals: { clones: 10, duplicatedLines: 688, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
  });

  it('rejects duplicate fingerprints', () => {
    expect(() =>
      buildRatchetedBaseline(baseline, {
        fingerprints: ['x', 'x'],
        totals: { clones: 1, duplicatedLines: 5, percentage: 0.1 },
      }),
    ).toThrow(/ambiguous/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.quality.config.ts tests/quality/update-duplication-baseline.test.ts`
Expected: FAIL — module has no export `buildRatchetedBaseline`. (If the quality config's `include` misses the new file, check `vitest.quality.config.ts` first and use the config whose include covers `tests/quality/**`.)

- [ ] **Step 3: Write the script**

```js
// scripts/update-duplication-baseline.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fingerprintDuplicate, isImportOnlyDuplicate } from './check-duplication.mjs';

export function buildRatchetedBaseline(baseline, { fingerprints, totals }) {
  const unique = new Set(fingerprints);
  if (unique.size !== fingerprints.length) {
    throw new Error('Clone fingerprints are ambiguous; refusing to write a baseline.');
  }
  if (
    totals.clones > baseline.limits.clones ||
    totals.duplicatedLines > baseline.limits.duplicatedLines
  ) {
    throw new Error(
      `This tool only ratchets down: clones ${totals.clones}/${baseline.limits.clones}, ` +
        `duplicatedLines ${totals.duplicatedLines}/${baseline.limits.duplicatedLines}.`,
    );
  }
  return {
    ...baseline,
    limits: { ...baseline.limits, clones: totals.clones, duplicatedLines: totals.duplicatedLines },
    knownCloneFingerprints: [...fingerprints].sort(),
  };
}

function main() {
  const root = process.cwd();
  const baselinePath = path.join(root, 'quality', 'duplication-baseline.json');
  const reportPath = path.join(root, 'reports', 'jscpd', 'jscpd-report.json');
  if (!existsSync(reportPath)) {
    console.error(
      'No jscpd report found. Run `npm run check:duplication` immediately before this tool; it writes the report even when the gate fails.',
    );
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const fingerprinted = report.duplicates.filter((d) => !isImportOnlyDuplicate(root, d));
  const fingerprints = fingerprinted.map((d) => fingerprintDuplicate(root, d));
  const totals = report.statistics.total;

  const label = (f) => `src/${f.name.replaceAll('\\', '/')}:${f.start}-${f.end}`;
  for (const d of fingerprinted) console.log(`- ${label(d.firstFile)} <-> ${label(d.secondFile)}`);
  console.log(
    `clones=${totals.clones} duplicatedLines=${totals.duplicatedLines} fingerprints=${fingerprints.length}`,
  );

  const next = buildRatchetedBaseline(baseline, { fingerprints, totals });
  if (!process.argv.includes('--apply')) {
    console.log('Dry run — review the clone list above, then re-run with --apply.');
    return;
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log('Baseline ratcheted.');
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) main();
```

Add to `package.json` scripts (next to the other `check:*` entries): `"baseline:duplication": "node scripts/update-duplication-baseline.mjs"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.quality.config.ts tests/quality/update-duplication-baseline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Dry-run against the real report**

Run: `npm run check:duplication` (expected to still FAIL — that is the known red), then `npm run baseline:duplication`.
Expected: clone list printed, `Dry run — …` message, exit 0. Do NOT `--apply` yet — real clones get removed first.

- [ ] **Step 6: Commit**

```bash
git add scripts/update-duplication-baseline.mjs tests/quality/update-duplication-baseline.test.ts package.json
git commit -m "chore(quality): add ratchet-only duplication baseline updater"
```

### Task 1.2: Validated-request helper + apply to flagged routes

~20 route files repeat the same 8-line params/body validation preamble (the jscpd cluster across `api/admin/campaigns/[id]/*`, `api/admin/feedback/[id]/*`, `api/admin/support/[id]/*`, `api/premium-quizzes/**`, `api/credits/*`, `api/internal/billing/*`). Absorb it into one helper.

**Files:**

- Create: `src/lib/api/validated.ts`
- Test: `src/lib/api/validated.test.ts`
- Modify (route group A — communication admin): `src/app/api/admin/campaigns/[id]/cancel/route.ts`, `.../prepare/route.ts`, `.../schedule/route.ts`, `.../test/route.ts`, `.../route.ts` (PATCH), `src/app/api/admin/feedback/[id]/complete/route.ts`, `.../messages/route.ts`, `.../remind/route.ts`, `.../route.ts`, `src/app/api/admin/support/[id]/messages/route.ts`, `.../route.ts`
- Modify (route group B — premium sessions & credits): `src/app/api/premium-quizzes/[id]/flashcards/session/route.ts`, `src/app/api/premium-quizzes/[id]/session/route.ts`, `src/app/api/premium-quizzes/sessions/[sessionId]/batch/route.ts`, `.../submit/route.ts`, `.../progress/route.ts`, `.../flashcards/card/route.ts`, `.../flashcards/reveal/route.ts`, `src/app/api/credits/route.ts`, `src/app/api/credits/history/route.ts`, `src/app/api/internal/billing/process/route.ts`, `src/app/api/internal/billing/reconcile/route.ts`

**Interfaces:**

- Consumes: `readAndValidateJson<T>(request, schema): Promise<ValidationResult<T>>`, `readAndValidateRouteParams<T>(params, schema): ValidationResult<T>`, `readAndValidateSearchParams<T>(request, schema): ValidationResult<T>` from `@/lib/api/request`; `apiErr(code, detail, status, meta)` from `@/lib/api/response`.
- Produces:
  - `validationFailure(result: ValidationFailureLike): NextResponse` — the standard `validation_error` 400 response.
  - `parseRouteParams<TParams>(params: RouteParams, schema: ZodType<TParams>): ParsedResult<TParams>`
  - `parseJsonBody<TBody>(request: NextRequest, schema: ZodType<TBody>): Promise<ParsedResult<TBody>>`
  - `parseParamsAndBody<TParams, TBody>(request: NextRequest, params: RouteParams, schemas: ParamsAndBodySchemas<TParams, TBody>): Promise<ParsedParamsAndBody<TParams, TBody>>`
    where `ParsedResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse }` and `ParsedParamsAndBody<TParams, TBody> = { ok: true; params: TParams; body: TBody } | { ok: false; response: NextResponse }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/validated.test.ts
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseJsonBody, parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

const idSchema = z.strictObject({ id: z.string().min(1) });
const bodySchema = z.strictObject({ revision: z.number().int().min(0) });

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('parseRouteParams', () => {
  it('returns data on success', () => {
    const result = parseRouteParams({ id: 'abc' }, idSchema);
    expect(result).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('returns a 400 validation_error envelope on failure', async () => {
    const result = parseRouteParams({}, idSchema);
    if (result.ok) throw new Error('expected failure');
    expect(result.response.status).toBe(400);
    const payload = await result.response.json();
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('validation_error');
  });
});

describe('parseJsonBody', () => {
  it('returns parsed body on success', async () => {
    const result = await parseJsonBody(jsonRequest({ revision: 2 }), bodySchema);
    expect(result).toEqual({ ok: true, data: { revision: 2 } });
  });

  it('rejects invalid JSON with 400', async () => {
    const request = new NextRequest('http://localhost/api/test', { method: 'POST', body: '{nope' });
    const result = await parseJsonBody(request, bodySchema);
    if (result.ok) throw new Error('expected failure');
    expect(result.response.status).toBe(400);
  });
});

describe('parseParamsAndBody', () => {
  it('validates params before body and returns both', async () => {
    const result = await parseParamsAndBody(
      jsonRequest({ revision: 1 }),
      { id: 'x' },
      {
        params: idSchema,
        body: bodySchema,
      },
    );
    if (!result.ok) throw new Error('expected success');
    expect(result.params).toEqual({ id: 'x' });
    expect(result.body).toEqual({ revision: 1 });
  });

  it('fails on bad params without reading the body', async () => {
    const result = await parseParamsAndBody(
      jsonRequest({ revision: 1 }),
      {},
      {
        params: idSchema,
        body: bodySchema,
      },
    );
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.node.config.ts src/lib/api/validated.test.ts`
Expected: FAIL — `@/lib/api/validated` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/api/validated.ts
import type { NextRequest, NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import {
  readAndValidateJson,
  readAndValidateRouteParams,
  type RouteParams,
  type ValidationResult,
} from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

export interface ValidationFailureLike {
  error: string;
  fields: Record<string, string>;
}

export type ParsedResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export type ParsedParamsAndBody<TParams, TBody> =
  | { ok: true; params: TParams; body: TBody }
  | { ok: false; response: NextResponse };

export interface ParamsAndBodySchemas<TParams, TBody> {
  params: ZodType<TParams>;
  body: ZodType<TBody>;
}

export function validationFailure(result: ValidationFailureLike): NextResponse {
  return apiErr('validation_error', result.error, 400, { fields: result.fields });
}

function toParsed<T>(result: ValidationResult<T>): ParsedResult<T> {
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, response: validationFailure(result) };
}

export function parseRouteParams<TParams>(
  params: RouteParams,
  schema: ZodType<TParams>,
): ParsedResult<TParams> {
  return toParsed(readAndValidateRouteParams(params, schema));
}

export async function parseJsonBody<TBody>(
  request: NextRequest,
  schema: ZodType<TBody>,
): Promise<ParsedResult<TBody>> {
  return toParsed(await readAndValidateJson(request, schema));
}

export async function parseParamsAndBody<TParams, TBody>(
  request: NextRequest,
  params: RouteParams,
  schemas: ParamsAndBodySchemas<TParams, TBody>,
): Promise<ParsedParamsAndBody<TParams, TBody>> {
  const parsedParams = parseRouteParams(params, schemas.params);
  if (!parsedParams.ok) return parsedParams;
  const parsedBody = await parseJsonBody(request, schemas.body);
  if (!parsedBody.ok) return parsedBody;
  return { ok: true, params: parsedParams.data, body: parsedBody.data };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.node.config.ts src/lib/api/validated.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite route group A (worked example, then the rest identically)**

`src/app/api/admin/campaigns/[id]/cancel/route.ts` before → after:

```ts
// AFTER
import type { NextRequest } from 'next/server';
import { cancelCampaignSchema, communicationIdParamsSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { cancelCampaign } from '@/lib/communication/service';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: cancelCampaignSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await cancelCampaign(
        parsed.params.id,
        { id: context.userId, email: context.email },
        parsed.body.revision,
        parsed.body.reason,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-cancel');
  }
});
```

Apply the identical transformation to every group-A route: replace the `readAndValidateRouteParams` + `readAndValidateJson` + two `apiErr('validation_error', …)` blocks with one `parseParamsAndBody` (or `parseRouteParams`/`parseJsonBody` alone when the route only has one of the two). Keep every schema, service call, and error-mapper exactly as-is. Routes with GET handlers that validate only params use `parseRouteParams`; routes validating search params keep `readAndValidateSearchParams` + `validationFailure(result)`.

- [ ] **Step 6: Rewrite route group B the same way**

Same transformation for the premium-quizzes/credits/internal-billing files listed above. These use `withAuth`/internal auth wrappers instead of `withAdmin` — do not change the wrapper, only the validation preamble. Some of the flagged premium-session clones are session-guard blocks rather than validation; only replace validation code — if a flagged fragment is not validation, leave it for the baseline ratchet.

- [ ] **Step 7: Verify behavior unchanged**

Run: `npm run typecheck && npx eslint src/lib/api/validated.ts src/app/api --max-warnings 0 && npm run test:node`
Expected: all PASS (route tests like `src/app/api/quiz-drafts/[id]/submit/route.test.ts` exercise the validation envelope; they must pass unmodified).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api/validated.ts src/lib/api/validated.test.ts src/app/api
git commit -m "refactor(api): absorb repeated params/body validation preamble into parse helpers"
```

### Task 1.3: Merge the rate-limit twins

`src/lib/auth-rate-limit.ts` and `src/lib/billing-rate-limit.ts` duplicate the limiter-cache/env-override/consume machinery (jscpd: 39-44↔44-49, 51-64↔56-69). Extract one core; keep both public modules, their action types, defaults, env-var names (`AUTH_RATE_*`, `BILLING_RATE_*`), collections (`auth_rate_limits`, `billing_rate_limits`), key prefixes, and error behavior byte-identical.

**Files:**

- Create: `src/lib/rate-limit-core.ts`
- Test: `src/lib/rate-limit-core.test.ts`
- Modify: `src/lib/auth-rate-limit.ts`, `src/lib/billing-rate-limit.ts`

**Interfaces:**

- Produces:

```ts
export interface RateLimitWindow {
  points: number;
  durationSec: number;
}
export interface RateLimiterRegistryOptions {
  collection: string;
  keyPrefix: string;
  envPrefix: string;
}
export type RateLimitOutcome =
  | { allowed: true; remaining: number; resetSeconds: number; limit: number }
  | { allowed: false; retryAfterSeconds: number; limit: number };
export interface RateLimiterRegistry<TAction extends string> {
  resolveLimit(action: TAction): RateLimitWindow;
  consume(action: TAction, key: string): Promise<RateLimitOutcome>;
}
export function createRateLimiterRegistry<TAction extends string>(
  options: RateLimiterRegistryOptions,
  defaults: Record<TAction, RateLimitWindow>,
): RateLimiterRegistry<TAction>;
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rate-limit-core.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mongoose', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
const consume = vi.fn();
vi.mock('rate-limiter-flexible', () => {
  class RateLimiterRes extends Error {
    msBeforeNext = 4_000;
  }
  class RateLimiterMongo {
    consume = consume;
    constructor(public options: Record<string, unknown>) {}
  }
  return { RateLimiterMongo, RateLimiterRes };
});
vi.mock('mongoose', () => ({ default: { connection: { db: {} } } }));

import { RateLimiterRes } from 'rate-limiter-flexible';
import { createRateLimiterRegistry } from '@/lib/rate-limit-core';

const registry = createRateLimiterRegistry(
  { collection: 'test_limits', keyPrefix: 'test', envPrefix: 'TEST_RATE' },
  { ping: { points: 3, durationSec: 60 } },
);

describe('createRateLimiterRegistry', () => {
  it('honors env overrides via <envPrefix>_<ACTION>_<POINTS|DURATION>', () => {
    process.env['TEST_RATE_PING_POINTS'] = '7';
    expect(registry.resolveLimit('ping').points).toBe(7);
    delete process.env['TEST_RATE_PING_POINTS'];
    expect(registry.resolveLimit('ping').points).toBe(3);
  });

  it('maps a successful consume to an allowed outcome', async () => {
    consume.mockResolvedValueOnce({ remainingPoints: 2, msBeforeNext: 30_000 });
    await expect(registry.consume('ping', 'k')).resolves.toEqual({
      allowed: true,
      remaining: 2,
      resetSeconds: 30,
      limit: 3,
    });
  });

  it('maps quota exhaustion to a disallowed outcome and rethrows operational errors', async () => {
    consume.mockRejectedValueOnce(new RateLimiterRes());
    await expect(registry.consume('ping', 'k')).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 4,
      limit: 3,
    });
    consume.mockRejectedValueOnce(new Error('mongo down'));
    await expect(registry.consume('ping', 'k')).rejects.toThrow('mongo down');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.node.config.ts src/lib/rate-limit-core.test.ts`
Expected: FAIL — module missing. (If the mock shape fights the real module's `import 'server-only'`, mock `'server-only'` as `vi.mock('server-only', () => ({}))` — check how `src/lib/auth-rate-limit.test.ts` already handles it and mirror that setup exactly.)

- [ ] **Step 3: Implement the core by extracting VERBATIM from `auth-rate-limit.ts`**

Move `envOverride`, `resolveLimit`, `getLimiter`, the limiter cache, and the consume/`RateLimiterRes` branch into `createRateLimiterRegistry` (parameterized by `collection`, `keyPrefix`, `envPrefix`, `defaults`). Keep `import 'server-only'`, `connectDB()` before consume, and `disableIndexesCreation: process.env.NODE_ENV === 'production'` exactly as they are. Then:

- `auth-rate-limit.ts` keeps: `AuthRateLimitAction`, `DEFAULTS`, `AuthRateLimitResult` (aliasing `RateLimitOutcome`), `checkAuthRateLimit` (delegates to registry `consume`), `rateLimitResponse` — unchanged signatures.
- `billing-rate-limit.ts` keeps: `BillingRateLimitAction`, `DEFAULTS`, its doc comments, and `consumeBillingRateLimit` which calls the registry and throws `BillingDomainError('rate_limit_exceeded', …, 429)` when disallowed — same message format with `retryAfterSeconds`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config vitest.node.config.ts src/lib/rate-limit-core.test.ts src/lib/auth-rate-limit.test.ts`
Expected: PASS — including the pre-existing auth-rate-limit tests, unmodified.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit-core.ts src/lib/rate-limit-core.test.ts src/lib/auth-rate-limit.ts src/lib/billing-rate-limit.ts
git commit -m "refactor(lib): extract shared mongo rate-limiter core from auth/billing twins"
```

### Task 1.4: Intra-file clone removal in communication DTOs and models

**Files:**

- Modify: `src/dtos/communication.ts` (clone 50-56 ↔ 143-149), `src/models/Communication.ts` (clone 503-509 ↔ 558-564)

**Interfaces:**

- Consumes/Produces: all existing exported schema names stay identical (`feedbackListQuerySchema`, `campaignListQuerySchema`, model schemas). Internal helpers only.

- [ ] **Step 1: Extract the shared list-query schema in `src/dtos/communication.ts`**

Both `feedbackListQuerySchema` and `campaignListQuerySchema` repeat `page`/`limit`/`status`-enum-with-default. Add a module-private builder above them:

```ts
function pagedStatusQuery<const T extends readonly [string, ...string[]]>(statuses: T) {
  return z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(statuses).default('all'),
  });
}
```

Then: `export const feedbackListQuerySchema = pagedStatusQuery([...]).extend({ userId: mongoId.optional() });` and `export const campaignListQuerySchema = pagedStatusQuery([...]);` with each schema's own status list verbatim. Verify the inferred types are unchanged: `npm run typecheck`.

- [ ] **Step 2: Extract the shared lease-queue field block in `src/models/Communication.ts`**

The `EmailCampaignAudienceSchema` and `EmailOutboxSchema` repeat `attempts`/`availableAt`/`leaseUntil`/`leaseToken`/`lastError` (different `lastError` maxlength: 1000 vs 2000). Add a module-private helper:

```ts
function leaseQueueFields(lastErrorMaxLength: number) {
  return {
    attempts: { type: Number, required: true, default: 0, min: 0 },
    availableAt: { type: Date, required: true, default: Date.now },
    leaseUntil: { type: Date, default: null },
    leaseToken: { type: String, default: null },
    lastError: { type: String, default: null, maxlength: lastErrorMaxLength },
  } as const;
}
```

Spread `...leaseQueueFields(1_000)` / `...leaseQueueFields(2_000)` in place of the repeated blocks. Field order in the schema definition must keep the current order (put the spread exactly where the block was).

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run test:node && npm run test:component`
Expected: PASS — communication model/service tests (`service.outbox.test.ts` etc.) unmodified and green.

- [ ] **Step 4: Commit**

```bash
git add src/dtos/communication.ts src/models/Communication.ts
git commit -m "refactor(communication): extract shared list-query and lease-queue field builders"
```

### Task 1.5: ESLint size/complexity guardrails

`eslint . --max-warnings 0` turns warnings into failures, so a warn-tier is meaningless here — use a single error threshold with a frozen allowlist. The lint script must stay green on the current tree.

**Files:**

- Modify: `eslint.config.mjs`

- [ ] **Step 1: Generate the frozen allowlist of files currently ≥ 500 raw lines**

Run (Git Bash):

```bash
find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' ! -name '*.spec.*' ! -path 'src/generated/*' | xargs wc -l | awk '$1>=500 && $2!="total" {print $2}' | sort
```

Copy the output into the config as `oversizedFileAllowlist` (expect ~35 entries, e.g. `src/lib/communication/service.ts`, `src/repositories/BillingRepository.ts`, `src/components/app-chrome/AppChrome.tsx`, …).

- [ ] **Step 2: Add two rule blocks to `eslint.config.mjs`** (before the `prettier` entry)

```js
const oversizedFileAllowlist = [
  // FROZEN 2026-08-30: may only shrink. New files must stay under 500 lines.
  // …paste Step 1 output here…
];

// then inside defineConfig(...):
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: [...oversizedFileAllowlist, '**/*.test.*', '**/*.spec.*', 'src/generated/**'],
  rules: {
    'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
  },
},
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['**/*.test.*', '**/*.spec.*', 'src/generated/**'],
  rules: {
    complexity: ['error', { max: 30 }],
  },
},
```

- [ ] **Step 3: Run lint; freeze any complexity offenders**

Run: `npx eslint . --max-warnings 0`
If `complexity` flags existing functions, add those files to a second frozen list on the complexity block's `ignores` (same freeze comment). Do NOT raise the thresholds and do NOT add inline eslint-disable comments.

- [ ] **Step 4: Full lint gate**

Run: `npm run lint`
Expected: PASS (this also runs the check:\* prefix scripts).

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore(lint): enforce max-lines 500 and complexity 30 with frozen legacy allowlists"
```

### ~~Task 1.6: Make `check:dead-code` green~~ — DELETED 2026-08-30 (obsolete after rebase)

This task was written against a stale base. Master commit `8c84413b chore(quality): tighten the gate scripts and re-baseline duplication down` already cleaned knip: the 12 unused exports + 33 unused types the original audit listed no longer exist.

After rebasing onto master, `npm run check:dead-code` reported exactly two items, both introduced by Task 1.2's own new file. They were fixed inside Task 1.2's fix round (commit `e19a676f`) — where a regression belongs.

**No work remains. Skip this task.**

### Task 1.7: Wave 1 gate + baseline ratchet

- [ ] **Step 1: Re-run duplication and review what remains**

Run: `npm run check:duplication` — likely still failing, but the clone list should now be dominated by: god-file internal clones (Wave 2), layer-echo clones (Wave 4), and fingerprint-shifted survivors. Confirm every route-preamble/rate-limit/communication-intra-file clone from the 2026-08-29 list is gone. If any remain, fix them before proceeding.

- [ ] **Step 2: Ratchet the baseline**

Run: `npm run check:duplication:rebaseline` (review the printed added/removed clone list — every clone on it must be one you deliberately left for a later wave), then `npm run check:duplication`.
Expected: `Duplicate-code check passed with no baseline regression.`

> Note (2026-08-30, Task 2.8a): `scripts/update-duplication-baseline.mjs` and `npm run baseline:duplication` were retired as a duplicate, buggy copy of `scripts/check-duplication.mjs`'s pre-existing `rebaselineDuplication`/`--rebaseline`. Its one real improvement, the ratchet-only guard, was folded into `rebaselineDuplication` (now exported as `assertRatchetableBaseline`). Use `npm run check:duplication:rebaseline` wherever this plan says `baseline:duplication`.

- [ ] **Step 3: Full wave gate**

Run: `npm run typecheck && npm run typecheck:scripts && npm run lint && npm run test:node && npm run test:component && npm run test:quality`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add quality/duplication-baseline.json
git commit -m "chore(quality): ratchet duplication baseline after wave 1 dedupe"
```

---

## Wave 2 — Split god modules

**AMENDMENT 2026-08-30 (ruling R9) — introduce `withCommunicationMutation` while you are in these files.**

After Task 1.2 converted the admin routes, `check:duplication` surfaced a NEW clone at lines 10-17 of `admin/campaigns/[id]/{cancel,prepare,schedule,test}`, `admin/campaigns/[id]/route.ts`, `admin/feedback/[id]/{complete,messages,remind}` and `admin/support/[id]/messages`. Removing the validation preamble made the remaining preamble MORE uniform: `withAdmin(...)` + `try` + `assertCommunicationMutationRequest(request)` + the parse call + the same `communicationHttpError(error, '<label>')` catch.

Master already solved the identical problem for billing with `withBillingOrderMutation(schema, auditLabel, handler)` in `src/lib/api/billing-order-mutation.ts` — READ THAT FILE FIRST and mirror its shape.

Tasks 2.2, 2.3 and 2.4 already edit every one of these routes to change their imports, so add a `withCommunicationMutation` wrapper in `src/lib/communication/http.ts` (or a sibling module — it must NOT be a re-export-only file) that folds in the admin guard, the mutation assertion, params+body parsing, and the `communicationHttpError` mapping, then apply it to those routes as part of the same task.

This ELIMINATES the clone structurally instead of baselining it. Behavior must stay byte-identical — same audit label per route, same error envelope, same status codes.

GitNexus protocol applies to every task here: run upstream impact on each moved/edited export before cutting; stop on HIGH/CRITICAL and report.

### Task 2.1: `lib/communication/internal.ts` — shared plumbing

**Files:**

- Create: `src/lib/communication/internal.ts`
- Modify: `src/lib/communication/service.ts`

**Interfaces:**

- Produces (moved verbatim from `service.ts`, same signatures): `PageResult<T>`, `DAY`, `configuredRate(name, fallback): number`, `siteUrl(): string`, `requiredObjectId(value, label?): Types.ObjectId`, `pageMeta(page, limit, total)`, `auditExpiry(): Date`, `audit(...)`, `userEmailMap(ids): Promise<Map<string, string>>`, `digest(value): string`, `isMongoDuplicateKeyError(error): boolean`, `queueMail(...)`.
- Rule for anything not on this list: a helper used by ≥2 of the future domain modules goes to `internal.ts`; a helper used by exactly one domain stays with that domain (verified by compile, not guesswork).

- [ ] **Step 1:** Move the listed helpers verbatim into `internal.ts` (exported), update `service.ts` to import them. No logic edits.
- [ ] **Step 2:** Run: `npm run typecheck && npx vitest run --config vitest.node.config.ts src/lib/communication` — PASS, tests unmodified.
- [ ] **Step 3:** Commit: `refactor(communication): extract cross-domain plumbing into internal module`

### Task 2.2: `lib/communication/support.ts`

**Files:**

- Create: `src/lib/communication/support.ts`
- Modify: `src/lib/communication/service.ts` (shrinks), plus callers: `src/app/api/support/tickets/route.ts`, `src/app/api/support/tickets/[ticketId]/route.ts`, `.../messages/route.ts`, `.../reopen/route.ts`, `src/app/api/support/attachments/presign/route.ts`, `src/app/api/admin/support/route.ts`, `src/app/api/admin/support/[id]/route.ts`, `.../messages/route.ts`

**Interfaces:**

- Produces (moved, signatures unchanged): `listSupportTickets`, `getSupportTicket`, `createSupportAttachmentUpload`, `createSupportTicket`, `addSupportMessage`, `updateSupportTicket`, `reopenSupportTicket`.
- Domain-private helpers moving along: `supportTicketView`, `finalizeSupportAttachments`, `SUPPORT_UPLOAD_ROOT`, `SUPPORT_READY_ROOT`, and the sharp/S3 attachment helpers they use.

- [ ] **Step 1:** GitNexus impact on the 7 exports; record; stop if HIGH/CRITICAL.
- [ ] **Step 2:** Move the exports + private helpers verbatim; while moving, collapse the jscpd clone `service.ts:623-632 ↔ 755-764` (the shared notification-queueing block in `createSupportTicket` vs `addSupportMessage`) into one module-private helper, e.g. `queueSupportNotification(ticket, message)` — exact signature from the actual duplicated code.
- [ ] **Step 3:** Update the 8 caller routes' imports to `@/lib/communication/support`.
- [ ] **Step 4:** Run: `npm run typecheck && npm run test:node && npm run check:architecture` — PASS.
- [ ] **Step 5:** Commit: `refactor(communication): move support ticket domain into support module`

### Task 2.3: `lib/communication/feedback.ts`

**Files:**

- Create: `src/lib/communication/feedback.ts`
- Modify: `src/lib/communication/service.ts`, callers: `src/app/api/admin/feedback/route.ts`, `src/app/api/admin/feedback/[id]/route.ts`, `.../complete/route.ts`, `.../messages/route.ts`, `.../remind/route.ts`, `src/app/api/feedback/preferences/route.ts`; tests: `src/lib/communication/service.feedback-gating.test.ts` (imports only)

**Interfaces:**

- Produces (moved, signatures unchanged): `listFeedback`, `getFeedback`, `createFeedback`, `addFeedbackMessage`, `remindFeedback`, `completeFeedback`, `applyFeedbackPreference`.
- Domain-private helpers moving along: `feedbackConversationView`, `CLOSED_FEEDBACK_STATUSES`, `OPEN_FEEDBACK_STATUSES`, `isClosedFeedbackStatus`, `feedbackToken`, `compactFeedbackReplyToken`, `feedbackPreferencesUrl`, `feedbackReplyAddress`, `rejectPromotionalFeedback`; `cancelQueuedFeedbackMail` goes wherever the ≥2-domains rule says after Task 2.5's grep.

- [ ] **Step 1:** GitNexus impact on the 7 exports.
- [ ] **Step 2:** Move verbatim; collapse the clone cluster `1041-1050↔1142-1151`, `1060-1074↔1167-1181`, `1091-1104↔1198-1211`, `1104-1125↔1211-1232`, `1125-1141↔1232-1248` — the mail-composition/queueing sequence duplicated between `addFeedbackMessage` and `remindFeedback` — into one module-private helper (e.g. `queueFeedbackReplyMail(conversation, actor, body, kind)`); read both regions and extract exactly the common statements, parameterizing only what differs.
- [ ] **Step 3:** Update the 6 caller routes + test imports.
- [ ] **Step 4:** Run: `npm run typecheck && npx vitest run --config vitest.node.config.ts src/lib/communication && npm run check:architecture` — PASS; the feedback-gating tests still pass with only their import line changed.
- [ ] **Step 5:** Commit: `refactor(communication): move feedback domain into feedback module`

### Task 2.4: `lib/communication/campaigns.ts`

**Files:**

- Create: `src/lib/communication/campaigns.ts`
- Modify: `src/lib/communication/service.ts`, callers: `src/app/api/admin/campaigns/route.ts`, `src/app/api/admin/campaigns/[id]/route.ts`, `.../cancel/route.ts`, `.../prepare/route.ts`, `.../schedule/route.ts`, `.../test/route.ts`, `src/app/api/user/marketing-preferences/route.ts`

**Interfaces:**

- Produces (moved, signatures unchanged): `listCampaigns`, `getCampaign`, `createCampaign`, `updateCampaign`, `testCampaign`, `prepareCampaign`, `scheduleCampaign`, `cancelCampaign`, `getMarketingPreferences`, `updateMarketingPreferences`.
- Domain-private helpers moving along: `campaignView`, `campaignContentHash`, `campaignBlocks`.

- [ ] **Step 1:** GitNexus impact on the 10 exports.
- [ ] **Step 2:** Move verbatim; collapse clones `1485-1494↔1510-1519` (create vs update shared block) and `1544-1552↔1579-1587` (test vs prepare shared revision/state guard) into module-private helpers extracted from the actual code.
- [ ] **Step 3:** Update the 7 caller routes.
- [ ] **Step 4:** Run: `npm run typecheck && npm run test:node && npm run check:architecture` — PASS.
- [ ] **Step 5:** Commit: `refactor(communication): move campaign + marketing-preference domain into campaigns module`

### Task 2.5: `lib/communication/worker.ts` + delete `service.ts`

**Files:**

- Create: `src/lib/communication/worker.ts`
- Delete: `src/lib/communication/service.ts`
- Modify: callers `src/app/api/internal/communications/worker/route.ts`, `src/app/api/admin/communications/health/route.ts`, `src/app/api/webhooks/resend/route.ts`; tests `service.outbox.test.ts`, `service.inbound.test.ts` (imports; optionally rename to `worker.outbox.test.ts`, `worker.inbound.test.ts` to keep names honest)

**Interfaces:**

- Produces (moved, signatures unchanged): `sanitizeOutboxError`, `processResendWebhook`, `runCommunicationWorker`, `communicationHealth`.
- The whole outbox/audience/retention machinery moves here: `quarantineWebhook`, `processInboundFeedback`, `CAMPAIGN_METRIC_FIELD`, `enforceCampaignSafety`, `recordMarketingSuppression`, `campaignTerminalDeliverySummary`, `webhookEmailId`, `processDeliveryEvent`, `syncUnsubscribeEvent`, `outboxIdempotencyKey`, `cancelOutbox`, `demoteUnsentInvitation`, `prepareFeedbackDelivery`, `markInvitationSent`, `processOutbox`, `processCampaignAudience`, `processPendingCampaignCancellations`, `processCommunicationRetention`, `expireUnansweredFeedback`.

- [ ] **Step 1:** GitNexus impact on the 4 exports.
- [ ] **Step 2:** Move everything remaining in `service.ts` here; collapse clone `2425-2435↔2551-2561` (shared lease/claim block between `processOutbox` and `processCampaignAudience`) into a module-private helper. Now apply the ≥2-domains rule: for each helper that both `worker.ts` and a domain module need (`cancelQueuedFeedbackMail`, `enforceCampaignSafety`, …), grep usage; promote genuinely shared ones to `internal.ts`, keep single-domain ones private.
- [ ] **Step 3:** Delete `service.ts`. Run `grep -rn "communication/service" src tests` — expect zero hits.
- [ ] **Step 4:** Run: `npm run typecheck && npx vitest run --config vitest.node.config.ts src/lib/communication && npm run test:node && npm run check:architecture && npm run check:dead-code` — PASS (knip confirms nothing moved became orphaned).
- [ ] **Step 5:** Commit: `refactor(communication): move worker/webhook/health machinery and retire the service god module`

### ~~Task 2.6: BillingRepository facade split~~ — DELETED 2026-08-30 (already done on master)

This task was written against a stale base. Master commit `4f9bc9fa refactor(billing): split the billing repository and make illegal states unrepresentable` already did it, and went further than this plan proposed.

`src/repositories/BillingRepository.ts` NO LONGER EXISTS. Master replaced it with seven repositories plus three helper modules under `src/repositories/billing/`: `BillingAdjustmentRepository`, `BillingAlertRepository`, `BillingOrderRepository`, `BillingPromotionRepository`, `BillingSettlementRepository`, `InternalNonceRepository`, `WebhookInboxRepository`, and `billing-shared.ts`, `promotion-lifecycle.ts`, `settlement-writers.ts`.

Ruling R3 (five stores, not the spec's four) is therefore moot — master chose seven.

**No work remains. Skip this task.**

**Follow-on candidates this split left behind** (NOT commitments; raise with the user before acting): `src/repositories/billing/BillingOrderRepository.ts` is 810 lines, `settlement-writers.ts` 683, `src/models/Billing.ts` 778. All three exceed the 500-line threshold Task 1.5 introduces, so they will land in that task's frozen allowlist rather than being split here.

### Task 2.7: PremiumQuizService internal dedupe

**Files:**

- Modify: `src/services/premium/PremiumQuizService.ts`

**Interfaces:** public API unchanged. New private helpers:

- `private async openPlaySession(context: PremiumAccessContext, quizId: string): Promise<OpenedPlaySession>` — the duplicated publication-lookup + access-check + `createSession` block shared by `startFlashcardSession` (≈527-539) and `startSession` (≈597-609); `OpenedPlaySession` is a named type `{ publication: PremiumQuizSubmission; session: PremiumPlaySession }`.
- `private decodeOwnedCursor(cursor: string, sessionId: string, userId: string): DecodedPremiumCursor` — the cursor-ownership guard shared by `getFlashcard` (≈551-557) and `revealFlashcard` (≈574-580); reuse the existing decoded-cursor type name from `decodeCursor`.
- `private async loadLivePublication(session: PremiumPlaySession, options: LoadLivePublicationOptions): Promise<PremiumQuizSubmission>` — the quota-consume + snapshot-staleness + publication-fetch sequence shared by `getFlashcard` (≈558-567) and `getBatch` (≈628-637); `LoadLivePublicationOptions = { consumeQuota: boolean; userId: string; sessionId: string; snapshotHash: string }` adjusted to the real code.
- `private sessionWatermark(session: PremiumPlaySession): string` and `private cursorBase(publication: PremiumQuizSubmission, session: PremiumPlaySession): PremiumCursorBase` — the watermark-hash + cursorBase blocks shared by `buildBatch` (≈779-795) and `buildFlashcard` (≈825-841).

- [ ] **Step 1:** GitNexus impact on `PremiumQuizService`.
- [ ] **Step 2:** Extract the five helpers; adjust exact signatures to the real code (the line refs above locate each pair). No behavior change — same errors, same order of checks.
- [ ] **Step 3:** Run: `npm run typecheck && npx vitest run --config vitest.node.config.ts src/services/premium && npm run test:node` — PASS, tests unmodified.
- [ ] **Step 4:** Commit: `refactor(premium): extract shared session/cursor/publication helpers in PremiumQuizService`

### Task 2.8: Wave 2 gate

- [ ] **Step 1:** Run `npm run check:duplication`; confirm every god-file internal clone is gone; ratchet: `npm run check:duplication:rebaseline` (review the printed clone list); re-run — green.
- [ ] **Step 2:** ESLint allowlist ratchet: re-run the Task 1.5 Step-1 command; remove every file no longer ≥500 lines from `oversizedFileAllowlist` (communication modules, BillingRepository, PremiumQuizService if under).
- [ ] **Step 3:** Full gate: `npm run typecheck && npm run typecheck:scripts && npm run lint && npm run test:node && npm run test:component && npm run test:quality && npm run check:dead-code` — all PASS.
- [ ] **Step 4:** `detect_changes({scope: "staged"})` per commit already done; now run GitNexus `detect_changes({scope: "compare", base_ref: "master"})` and confirm affected flows are only communication/billing/premium.
- [ ] **Step 5:** Commit baseline + allowlist: `chore(quality): ratchet duplication baseline and size allowlist after wave 2`

---

## Wave 3 — Standardize the 18 client pages

**Shared procedure (applies to every task in this wave; each task names its page-specific parameters):**

1. `page.tsx` currently starts with `'use client'`. Create the client component file (path per task), move the ENTIRE page file content there verbatim — including `'use client'`, all imports, hooks, handlers, and JSX — renaming only the default-exported function to the component name per task, exported as a named export.
2. Rewrite `page.tsx` as exactly:

```tsx
import { <ComponentName> } from '<feature path>';

export default function <PageName>Page() {
  return <<ComponentName> />;
}
```

Keep any existing `export const dynamic = …` line in `page.tsx`. Do NOT add metadata, auth checks, or Suspense wrappers (visual/behavior freeze). VERIFIED 2026-08-30: not one of the 18 pages takes `params` or `searchParams` as a prop — every one is `export default function XPage()` with zero parameters, already reading route data via hooks internally. So there is NO prop threading and NO `useParams()` rewiring to do; the move is a pure verbatim relocation plus a rename. Do not add prop plumbing that the page never had. 3. SWR conversion (only for pages marked "convert" below): replace each initial-data-load `useEffect` with `useSWR(key, fetcher, { revalidateOnFocus: false, revalidateOnReconnect: false })` where `fetcher` is the existing feature-api function already imported; derive the old `loading` flag as `isLoading || isValidating` so post-mutation `mutate()` reproduces the old reload-skeleton behavior; move the old catch-branch `toast.error(...)` into the `onError` option unchanged. Mutations stay imperative and call `mutate()` where the old code called `reload()`. Effects that are not data loading (timers, subscriptions, focus handlers) stay untouched. 4. Constraint check: the moved file must not import `@/dtos/*` or call `fetch(`/`fetchApi*` directly (it didn't as a page; moving can't add any). 5. Verify: `npm run typecheck && npx eslint <both files> --max-warnings 0 && npm run test:component && npm run check:architecture` — PASS. Grep the new client file and old page for accidental diffs: the JSX section must be byte-identical apart from the component name line. 6. Commit: `refactor(<feature>): split <page> into server shell + client component[ and unify fetching on SWR]`.

**Placement rule:** the client component goes under the feature whose `api/` module the page already imports; when a page imports from several, pick the dominant one (most imports). Create missing `components/` directories as needed.

### Task 3.1: admin/promotions (convert to SWR) — pilot

- Files: Modify `src/app/[locale]/(app)/admin/promotions/page.tsx`; Create `src/features/admin/promotions/components/AdminPromotionsPageClient.tsx`
- Component: `AdminPromotionsPageClient`. SWR: key `'admin-promotions'`, fetcher `fetchAdminPromotions`; old `reload()` → `mutate()`; `loading` → `isLoading || isValidating`; the `[t]`-dep effect's toast goes to `onError`.
- [ ] Steps 1-6 of the shared procedure. This is the pilot — if anything in the procedure doesn't survive contact with reality, STOP, fix the procedure text in this plan, and note the change before continuing to 3.2+.

### Task 3.2: admin/billing (convert) — `AdminBillingPageClient` in `src/features/admin/billing/components/`; two load effects → two `useSWR` calls keyed by their query state.

### Task 3.3: admin/ocr-keys (convert) — `OcrKeysPageClient` in `src/features/admin/ocr-keys/components/`; three effects: convert the data loads, keep any non-fetch effect.

### Task 3.4: admin/plans (convert) — `AdminPlansPageClient` in `src/features/admin/plans/components/`.

### Task 3.5: admin/premium-submissions (convert) — `PremiumSubmissionsPageClient` in `src/features/admin/premium-submissions/components/`.

### Task 3.6: admin/quizzes (convert) — `AdminQuizzesPageClient` in `src/features/admin/quizzes/components/`.

### Task 3.7: admin/reports (convert) — `AdminReportsPageClient` in `src/features/admin/reports/components/`.

### Task 3.8: admin/stats (convert) — `AdminStatsPageClient` in `src/features/admin/stats/components/` (existing feature dir; 653-line page also imports `LlmUsageSection`, `StatsModal` from there — imports shorten to relative).

### Task 3.9: admin/subscriptions (convert) — `AdminSubscriptionsPageClient` in `src/features/admin/subscriptions/components/`.

### Task 3.10: admin/users (already SWR — split only) — `AdminUsersPageClient` in `src/features/admin/users/components/`; 1,095 lines move verbatim; afterwards remove the page from `oversizedFileAllowlist` and add the client file if still ≥500 (it will be — keep it listed, frozen; Wave 3 does not further split page internals).

Each of 3.2–3.10 follows the shared procedure steps 1-6 with its own files/component/SWR keys; verification and commit per page.

### Task 3.11: explore (already SWR — split only) — `ExplorePageClient` in `src/features/explore/components/`.

### Task 3.12: quizzes (already SWR — split only) — client under the feature its api imports come from (`features/quizzes` expected) — `QuizzesPageClient`.

### Task 3.13: premium-quizzes (already SWR — split only) — `PremiumQuizzesPageClient`, feature per placement rule.

### Task 3.14: subscription (convert) — `SubscriptionPageClient` in `src/features/subscription/components/`.

### Task 3.15: review (convert) — `ReviewPageClient` in `src/features/review/components/`.

### Task 3.16: history/[attemptId] (convert) — `AttemptHistoryPageClient`, feature per placement rule (expected `features/quiz`). Page takes no props; it already reads the attempt id via hooks — move verbatim.

### Task 3.17: quiz/[slug]/result (convert) — `QuizResultPageClient` in `src/features/quiz/components/`; page already uses `useSearchParams` + `Suspense` internally — keep both in the client component untouched.

### Task 3.18: quiz/[slug]/flashcards (convert) — `FlashcardsPageClient` in `src/features/quiz/components/`. Page takes no props; it already reads the slug via hooks — move verbatim.

### Task 3.19: loading.tsx coverage

- Files: Create `src/app/[locale]/(app)/quiz/[slug]/result/loading.tsx` and `src/app/[locale]/(app)/quiz/[slug]/flashcards/loading.tsx` only — each rendering the exact skeleton component the page already uses (`QuizResultPageSkeleton`, `FlashcardPageSkeleton` from `@/components/ui/PageLoadingSkeletons`):

```tsx
import { QuizResultPageSkeleton } from '@/components/ui/PageLoadingSkeletons';

export default function Loading() {
  return <QuizResultPageSkeleton />;
}
```

- `admin/*` is already covered by `admin/loading.tsx`; `(app)/error.tsx` covers errors. Do NOT add loading files for pages with no existing skeleton component (inventing one would be a visual change).
- [ ] Verify + commit: `feat(app): route-level loading states reusing existing skeletons` — note: these render the same skeleton the client shows, so no visual change.

### Task 3.20: Wave 3 gate

- [ ] `npm run typecheck && npm run lint && npm run test:node && npm run test:component && npm run check:architecture && npm run check:dead-code && npm run check:duplication` (ratchet baseline if fingerprints shifted; review list first) — all PASS.
- [ ] `npm run build` — PASS (catches client/server boundary mistakes nothing else will).
- [ ] If a local dev environment with `MONGODB_URI` is available, run `npm run test:e2e` for the touched flows; otherwise record e2e as NOT RUN in the wave report.
- [ ] ESLint allowlist ratchet for all shrunk `page.tsx` files; add any moved client file ≥500 lines to the frozen list (they are grandfathered content, not new code).
- [ ] Commit gates/baseline updates: `chore(quality): ratchet baselines after wave 3 page splits`

---

## Wave 4 — Codify the three-layer type standard

### Task 4.1: Shared zod fragments within the DTO layer

**Files:**

- Modify: `src/dtos/quiz.ts`, `src/dtos/quiz-draft.ts`, `src/dtos/premium-quiz.ts`

**Interfaces:**

- `src/dtos/quiz.ts` additionally exports (names exact):
  - `export const quizComposeBaseFields` — the shared field set `{ title, description, questions, submitToPremium, rightsAttested }` with today's validators verbatim (title `.trim().min(1, 'Title is required').max(200)`, description `.trim().max(1000).optional()`, `questions: questionListSchema`, `submitToPremium: z.boolean()`, `rightsAttested: z.boolean().optional()`).
  - `export function premiumRightsRefinement(value: PremiumRightsFields, context: z.RefinementCtx): void` — the shared `.superRefine` body (`rightsAttested must be true when submitToPremium`), with `PremiumRightsFields = { submitToPremium: boolean; rightsAttested?: boolean }` exported as an interface.
  - `export const quizProgressAnswerSchema` — currently module-private; export it.
- Consumers: `quiz.ts`'s own `createQuizRequestSchema` = `z.strictObject({ ...quizComposeBaseFields, folderId: <existing string version>, pdfUrl: z.url().optional() }).superRefine(premiumRightsRefinement)`; `quiz-draft.ts`'s `submitQuizDraftRequestSchema` = `z.strictObject({ ...quizComposeBaseFields, folderId: objectIdSchema.nullable().optional() }).superRefine(premiumRightsRefinement)`; `premium-quiz.ts` imports `quizProgressAnswerSchema` from `./quiz` replacing its local copy (jscpd `premium-quiz.ts:107-112 ↔ quiz.ts:171-176`).

- [ ] **Step 1:** Implement; keep every inferred request type identical (compare `z.infer` results by letting `npm run typecheck` prove it — the DTO types are consumed by services/routes with explicit annotations).
- [ ] **Step 2:** Run: `npm run typecheck && npm run test:node && npm run check:architecture` — PASS (dto→dto imports are legal; no dto→entity import added).
- [ ] **Step 3:** Commit: `refactor(dtos): share quiz compose fields, rights refinement, and answer schema within the DTO layer`

### Task 4.2: Three-layer standard document

**Files:**

- Create: `docs/architecture/three-layer-standard.md`

- [ ] **Step 1:** Write the document with exactly this structure and substance (prose may be refined, content may not shrink):

```markdown
# RinKuzu Three-Layer Type Standard

Status: normative. Enforced by `npm run check:architecture` (scripts/check-layer-boundaries.mjs).
Companion: docs/architecture/source-of-truth-registry.md (data ownership), this doc (type ownership).

## The three layers and their type families

| Layer              | Code                                                              | Owns type family                                                                                                                                | Shape rules                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation       | src/app, src/components, src/features                             | View models (feature `api/` + `types/` modules)                                                                                                 | serialized wire data only; never imports @/dtos, @/entities, @/models, @/repositories; never calls fetch/fetchApi outside feature `api/` boundary modules |
| Application/Domain | src/services, src/entities, src/interfaces, src/dtos, src/mappers | DTO (src/dtos, zod is the source of truth, Date as ISO string, id as string) and Entity (src/entities, Date as Date, id as string, no mongoose) | DTOs never import entities/models/repositories; entities never reference `_id` or Mongo types; services depend on interfaces only                         |
| Persistence        | src/repositories, src/models                                      | Persistence records (src/repositories/types, `_id: ObjectId`, Date as Date) and mongoose schemas (src/models)                                   | only repositories touch models; one DDL writer (migrations), never request-path DDL                                                                       |

## Mappers are the only crossings

- src/mappers: DTO <-> Entity (serialize/deserialize at the service boundary).
- src/repositories/mappers: Entity <-> Persistence record (hydrate/dehydrate at the repository boundary).
- A mapper is runtime code and belongs to the layer pair it crosses; it may import both sides.

## Deliberate shape echoes are NOT debt

The same business concept appears up to three times (DTO / Entity / Persistence record) with
systematic differences (id vs \_id, string dates vs Date). This duplication is the cost of
decoupling and is intentional: each layer can evolve without breaking the others, and drift is
caught at the mappers by the type checker. Do NOT "fix" it by deriving one layer's type from
another across a boundary — `check:architecture` bans the imports that would require, on purpose.
Cross-layer echo clones are recorded in quality/duplication-baseline.json as known.

## Sharing IS allowed within a layer

- DTO layer: shared zod fragments (see src/dtos/quiz.ts `quizComposeBaseFields`).
- Persistence layer: shared field builders (see src/models/Communication.ts `leaseQueueFields`).
- Never share a runtime schema or type across layer boundaries; shared primitives live in src/shared
  only if they are layer-agnostic (constants, branded scalars), never whole record shapes.

## When you add a field

1. Add it to the mongoose schema + persistence record (persistence layer).
2. Thread it through the repository mapper — typecheck now points at every gap.
3. Add it to the entity, then the service logic.
4. Add it to the DTO zod schema and the DTO mapper.
5. Expose it through the feature api/view-model if the UI needs it.
```

- [ ] **Step 2:** Add the one-line breadcrumb comment to the top of each cross-layer echo file: `src/dtos/admin-billing-orders.ts`, `src/entities/AdminBillingOrders.ts`, `src/repositories/types/AdminBillingOrdersPersistence.ts`, `src/repositories/types/PremiumQuizPersistence.ts`, `src/models/PremiumPlaySession.ts`, `src/mappers/admin/AdminBillingOrdersDtoMapper.ts`, `src/repositories/mappers/AdminBillingOrdersPersistenceMapper.ts`:

```ts
// Shape echoes of this record in other layers are deliberate — see docs/architecture/three-layer-standard.md.
```

- [ ] **Step 3:** Run `npm run lint && npm run typecheck` — PASS. Commit: `docs(architecture): codify the three-layer type standard and mark deliberate shape echoes`

### Task 4.3: Final baseline ratchet + checker review

- [ ] **Step 1:** `npm run check:duplication` → remaining clones must ALL be cross-layer echoes or otherwise deliberate; review the printed list against the standard doc; `npm run check:duplication:rebaseline`; re-run — green.
- [ ] **Step 2:** Checker-vs-standard review: re-read `scripts/check-layer-boundaries.mjs` against `three-layer-standard.md`. The audit found them aligned; if Waves 1–3 exposed an enforcement gap (e.g. a rule the standard states but the checker misses), add the rule following the file's existing `checkRatchet` pattern with an empty allowlist, plus a case in `tests/quality` mirroring how existing checker rules are tested. If no gap: record "no checker change needed" in the commit body of Step 3.
- [ ] **Step 3:** Commit: `chore(quality): final duplication ratchet; checker verified against three-layer standard`

### Task 4.4: Final verification + handoff report

- [ ] **Step 1:** Full gates: `npm run typecheck && npm run typecheck:scripts && npm run format:check && npm run lint && npm run test:node && npm run test:component && npm run test:quality && npm run check:dead-code && npm run check:duplication && npm run check:architecture && npm run check:source-of-truth && npm run build`
- [ ] **Step 2:** GitNexus: reindex (`node .gitnexus/run.cjs analyze`), then `detect_changes({scope: "compare", base_ref: "master"})`; confirm affected flows ⊆ {communication, billing, premium, the 18 pages, dtos, quality tooling}.
- [ ] **Step 3:** `npm run prepush:full` (includes build) — PASS.
- [ ] **Step 4:** Write the handoff report (chat, not a file) listing: gates passed with output evidence; gates NOT run and why (`audit:consistency` and e2e need `MONGODB_URI`/live env; index/DDL untouched so no migration runs); every file changed grouped by wave; the frozen allowlists' remaining entries (what's still >500 lines and why: grandfathered client monolith internals earmarked for future work); exact commands for the user to re-verify.

## Self-review record

- Spec coverage: W1 items 1-4 → Tasks 1.2/1.3/1.4/1.5 (+1.1 tooling, +1.6 dead-code, an audit-red the spec's verification section requires reporting — fixed instead); W2 items 1-3 → Tasks 2.1-2.5/2.6/2.7; W3 all-18-pages + fetch unification + loading/error coverage → Tasks 3.1-3.19 (error.tsx already covered by existing `(app)/error.tsx` — no new files needed, recorded in 3.19); W4 items 1-4 → Tasks 4.1/4.3(baseline)/4.2/4.3(checker).
- Known deviation from spec: none outstanding. (The former "five stores, not four" deviation is moot — Task 2.6 was deleted on 2026-08-30 because master had already split BillingRepository into seven repositories.)
- Type consistency: helper names used in route rewrites (`parseParamsAndBody`, `parseRouteParams`, `parseJsonBody`, `validationFailure`) match Task 1.2's definitions; `createRateLimiterRegistry`/`RateLimitOutcome` match Task 1.3; communication module exports in Tasks 2.2-2.5 match the caller tables; `quizComposeBaseFields`/`premiumRightsRefinement`/`quizProgressAnswerSchema` match between Task 4.1's producer and consumer lists.
