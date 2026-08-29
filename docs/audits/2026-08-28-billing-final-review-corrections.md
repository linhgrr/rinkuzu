# Billing final-review corrections — verification report

**Date:** 2026-08-28
**Base:** `master` (`38c6a145`)
**Scope:** the 22 findings from the final review of the staged billing refactor.
**GitNexus `detect_changes` (compare `master`):** 151 files, 464 symbols, 71 execution
flows, risk **critical** — the pre-authorised scope for this wave.

Nothing here is committed. The worktree carries the change set; unrelated work is
untouched.

---

## What each finding turned into

### P0 — money and entitlement

**1. Refund or chargeback can no longer be outrun by fulfilment.** Net settlement is
an invariant of the fulfilment claim and of the commit, not a check made before
either. `armFulfillment` refuses unless the order is unfulfilled or processing, is
not in review, and `netPrincipalMinor >= finalMinor`; `markFulfilled` re-reads under
the transaction and raises `fulfillment_not_entitled` when the ledger moved beneath
it. An entitlement-losing adjustment cancels the queued work in the same commit.
Proven on a real local replica set in
`tests/integration/billing/FulfillmentEntitlement.integration.test.ts` (11 tests),
including the two distinct race outcomes — lease lost before the grant, and net
principal lowered while the lease was held.

**2. Reconciliation leases are fenced by opaque token.** Every post-claim write —
escalate, reschedule, provider-null, invariant mismatch — conditions on the claimed
token and returns a typed lost-lease outcome rather than writing through. Reclaim
races run against real Mongo in
`tests/integration/billing/WebhookInboxLease.integration.test.ts`.

### P1 — accounting

**3.** A normal successful payment projects `settlementStatus=settled` from the
ledger on every path that touches the order, so the projection is idempotent and
cannot drift from the money.

**4.** `chargeback_reversal` is rejected without sufficient outstanding chargeback
and above the outstanding amount (`reversal_without_chargeback`,
`reversal_exceeds_chargeback`), with cumulative and per-allocation cases pinned in
`settlement-math.test.ts`.

**5.** A duplicate-key race on an external adjustment reference re-reads and
discriminates: identical replay succeeds, a conflicting order, amount, allocation or
time is a conflict, and an unrelated unique collision is rethrown rather than
swallowed. `tests/unit/billing/record-adjustment.test.ts` (23 tests) plus concurrent
requests on real Mongo.

**6.** Excess resolution and `ExternalMoneyAdjustment` are one source of truth; the
enum-only path is gone, with no compatibility route left behind.

**7.** Merchant credit that brings an underpaid order to entitled arms and grants
fulfilment rather than restoring a grant that never existed, and a later reversal
revokes it.

**8.** Settlement-status derivation was reworked over the whole ledger, so status and
entitlement cannot contradict across mixed sequences.

**9.** The reconciliation drain claims only what it will work on — no lease is left
on rows beyond the budget (`tests/unit/billing/drain-budget.test.ts`).

Two real defects surfaced while writing these tests and were fixed: a
chargeback-disposed surplus reported `unallocated`, a dead-end queue state nobody
could clear (`RESOLUTION_PRECEDENCE` now labels `chargeback` as `refunded`); and
`recordExcessVerdict` always returned false because the projection earlier in the
same commit had already moved `excessResolution` off `unallocated`.

### Webhooks, operations, security

**10.** One PayOS checksum key. `PAYOS_CHECKSUM_KEYS` and every dual-key and rotation
path are removed from runtime, the outbound adapter, the validator, `.env.example`
and the runbook. No deprecated alias remains. Retained-payload encryption keeps its
versioned key list, which is a separate concern.

**11.** An abuse-hash secret is required when live webhook or payment traffic is
enabled; rate limiting fails closed rather than disappearing when a proxy header is
absent; request bodies are bounded as early as the platform allows; the docs now say
plainly that deliberately rate-limited requests are not persisted.

**12.** Fencing tokens on webhook inbox leases and on every completion and reschedule
write, with a stale-worker-after-reclaim test.

**13.** Retained raw payloads are revealed only through an authorised, audited
endpoint that answers `no-store`, and are never eagerly decrypted in list results.

**14.** Replay is an authorised, audited operation over the retryable, dead-letter and
unsupported rows — not a call to the public endpoint, and idempotency is preserved.

**15.** Webhook diagnostics are integrated into the admin billing UI against a real
read model.

**16.** Alerting is implemented as a fail-closed outbox: conditions are evaluated from
counters, recorded before delivery, and deduplicated by a conditional upsert on the
condition key with a severity-based cooldown. **No live messages are sent.** Logic is
covered in isolation (`billing-alerts.test.ts`, `raise-alerts.test.ts`, 19 tests).

### Architecture and quality

**17.** Provider, business and application orchestration are out of the persistence
repositories; `BillingOrderRepository` and `BillingAdjustmentRepository` no longer
construct concrete repositories or act as use-case services.

**18.** The 693-line admin billing page is broken into components and hooks with
diagnostics, replay and reveal integrated; no pass-through structure remains.

**19.** `test:integration` is in both `prepush:full` and `verify:full`, behind a
fail-closed test-DB fence: the URI must be loopback, plain `mongodb:`, and name a
database containing `test`. Covered by `tests/quality/integration-db-fence.test.ts`.

**20.** Duplication-baseline provenance no longer depends on an impossible
self-referential commit SHA. The artifact records `generatedFrom: 'working-tree'` and
a config fingerprint, and the gate fails closed on a stale fingerprint rather than
grandfathering new clones.

**21.** The generated GitNexus count-only edits to `AGENTS.md` and `CLAUDE.md` are
reverted — both files are byte-identical to `master`.

**22.** Webhook TTL and index contract covered locally; see below.

---

## Duplication: extracted, not admitted

The re-cut initially admitted six new clones. Three were removed by real extraction
rather than being absorbed into the baseline:

- `src/lib/api/internal-billing-tick.ts` — the HMAC-plus-nonce scaffolding both
  scheduler drains need, so neither can ship without the nonce.
- `src/lib/api/webhook-row-action.ts` — the admin row-action shape shared by reveal
  and replay.
- `src/services/billing/webhooks/payment-event.ts` — the webhook-to-payment-event
  mapping shared by the public endpoint and the replay path.

The remaining three are the DTO/entity/persistence/view-model mapper mirroring that
the enforced layering requires; they are carried as explicit fingerprints in the
baseline diff. Baseline: **58 clones, 582 duplicated lines** (from 62 / 640).

---

## Defects found by this wave's own verification

- **Unbounded scan on the diagnostics panel's default view.** An `executionStats`
  probe against a local replica set with 20 000 inbox rows showed the unfiltered
  listing as `COLLSCAN` + blocking `SORT` — 0 keys examined, 20 000 documents
  examined to return 20. The compound `{verificationClass, createdAt}` index cannot
  serve a read with no class chosen, and that collection grows with unauthenticated
  internet noise as much as with real payments, so the page an operator opens during
  an incident is the first thing to fail. Added `{createdAt: -1}` to the schema and
  the index contract: the same read is now `IXSCAN`, 20 keys and 20 documents
  examined.
- **`billingalerts` was absent from the index-contract mirror test**, so its contract
  entries were checked against nothing. Added to the model map; failing-first
  evidence recorded by flipping `raisedAt` to `-1` in the contract, which produces
  `billingalerts registry must exactly mirror its schema`.
- **A stale guard name in `tests/internal-route-csrf-contract.test.ts`.**
  `parseAndVerifyPayOSWebhook` had matched nothing anywhere in the repo since it was
  renamed — the exact vacuity the test's own comment warns about. The guard list now
  names real symbols, and a second test fails if any name in it stops existing.
- **`check:duplication:rebaseline` left the artifact unformatted**, failing the
  required `format:check` on every re-cut and inviting hand-edits to the one file
  that must be written from a single report. It now writes through Prettier.

---

## Gate results

All run on Node 22.23.1 against this worktree.

| Gate                                                                                                                                         | Result                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `typecheck`, `typecheck:scripts`, `typecheck:declarations`                                                                                   | pass                              |
| `format:check`                                                                                                                               | pass                              |
| `lint` (incl. api-error-codes, internal-api-fetch, architecture, no-nextauth-v4, design-system, question-content, eslint `--max-warnings 0`) | pass                              |
| `check:dead-code` (knip, strict + production)                                                                                                | pass, zero                        |
| `check:duplication`                                                                                                                          | pass, no baseline regression      |
| `check:test-integrity`                                                                                                                       | pass                              |
| `check:source-of-truth`                                                                                                                      | pass                              |
| `check:billing`                                                                                                                              | pass                              |
| `check:database-ddl`                                                                                                                         | pass, 0 violations                |
| `check:runtime-cycles`                                                                                                                       | pass                              |
| `check:required-e2e-flows`                                                                                                                   | pass (11 tests/suites in 2 files) |
| `test:node`                                                                                                                                  | 391 files, 2307 tests, pass       |
| `test:component`                                                                                                                             | 59 files, 294 tests, pass         |
| `test:integration` (real local replica set)                                                                                                  | 13 files, 82 tests, pass          |
| `test:quality`                                                                                                                               | 19 files, 269 tests, pass         |
| `test:unit` (with coverage)                                                                                                                  | 450 files, 2601 tests, pass       |
| `build`                                                                                                                                      | pass                              |
| `git diff --check`                                                                                                                           | clean                             |

`tests/database/database-ddl-boundary.test.ts` failed once, on a 60-second timeout,
during one `test:unit` run and passed on the others. It parses every first-party file
in the repo and takes 8.5 seconds standalone under coverage, so the failure is CPU
contention on this machine rather than a defect. Its timeout was left alone.

`typecheck:hardening` fails, as it does on `master`: 37 files across the application
carry `exactOptionalPropertyTypes` debt. One of them, `src/lib/communication/service.ts`,
is in this change set, but the only edit to it is removing an unused `export` at line
256 while its two errors are at lines 1703 and 2447. The gate is in neither
`prepush:full` nor `verify:full`.

---

## External and unrun

- **Atlas index migration — not applied, and its dry-run is unrun.** `.env` points at
  Atlas, so the planner was run only against a local throwaway replica set: 157
  actions, **all creates, no drops**, with the `paymentwebhookinboxes.retention` TTL
  and the two unique keys correctly classified sensitive and blocking. Applying even
  locally is gated behind an approval file naming an approver and a ticket; that
  approval was not forged, so the local apply was not performed. **The production
  dry-run and production `executionStats` remain external and unrun.**
- **`check:communications` fails on absent local configuration, not on code.** Eight
  environment variables are unset (`SUPPORT_MAIL_FROM`, `SUPPORT_ADMIN_EMAIL`,
  `FEEDBACK_MAIL_FROM`, `FEEDBACK_REPLY_DOMAIN`, `MARKETING_MAIL_FROM`,
  `RESEND_WEBHOOK_SECRET`, `RESEND_PRODUCT_UPDATES_TOPIC_ID`,
  `RESEND_PROMOTIONS_TOPIC_ID`). The script is untouched by this change set and also
  calls the live Resend API. The alerting logic itself is covered by isolated tests.
- **Critical subscription E2E — attempted, blocked, not passing.** The seed fence
  (`mongodb://localhost/rinkuzu_ci`) held and the app booted, but the run cannot
  complete on this machine: port 3000 is held by another process, and `AUTH_URL`,
  `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` in `.env` are pinned to it. Overriding the
  auth URLs at runtime got login working and the pricing page rendering, at which
  point the `MarketingPreferencePrompt` consent aside intercepts the click on
  **Subscribe**. That component is not in this change set, and the `@critical-auth`
  flow — which touches no billing code — fails in the same environment. Fixing it
  would require editing `.env` or protected visuals, both out of scope. **Not
  production-ready on E2E evidence.**

## Local test infrastructure left running

A Docker container `rinkuzu-test-mongo` (`mongo:7 --replSet rs0`, port 27017) was
started for the integration suite and is still running; the integration tests need
it. A separate pre-existing `rinkuzu_test_mongo` on port 27019 was not touched.
Scratch databases `rinkuzu_index_plan_test` and `rinkuzu_probe_test` were dropped.
One stray `creditwallets` row left by the failed E2E run was removed from
`rinkuzu_ci`; its `adminmutationfences` singleton was deliberately kept, as the
fixture requires.
