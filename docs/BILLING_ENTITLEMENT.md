# Billing and Premium entitlement

RinKuzu has one payment flow and one Premium authority.

## Canonical ownership

- Plans: `plans`
- Orders: `billingorders`
- Provider payment facts: `paymenttransactions`
- Entitlement facts: `entitlementgrants` and `entitlementadjustments`
- Rebuildable entitlement projection: `entitlementaccounts`

The runtime must never infer Premium from user snapshots, historical payment rows, callback pages, or client state.

## Canonical HTTP surface

- Plans: `GET /api/billing/plans`
- Quote and checkout: `/api/billing/quotes` and `/api/billing/orders`
- Provider webhook: `/api/billing/webhooks/{provider}`
- Current entitlement: `GET /api/entitlements/status`
- Checkout UI: `/checkout`

Routes do not contain an internal generation number. Payment completion is driven by verified provider facts and idempotent order fulfillment, not by a browser success callback.

## Background drains

The webhook endpoint only persists into `paymentwebhookinboxes`; it never fulfils inline. Two internal endpoints do the work, and both require an HMAC signature over `METHOD
path
timestamp
nonce` plus a single-use nonce:

- `POST /api/internal/billing/process` drains the webhook inbox and sweeps the paid-but-unfulfilled backlog.
- `POST /api/internal/billing/reconcile` polls due payment attempts against the provider and releases expired promo reservations.

`infra/cloudflare/billing-scheduler` is the only caller. It runs on a one-minute Cloudflare cron and signs each request with `BILLING_INTERNAL_HMAC_SECRET`. **Without a running scheduler, a customer only becomes Premium if they return to `/checkout` from the provider — anyone who pays and closes the tab is charged and gets nothing.** `src/services/billing/billing-security.test.ts` pins the scheduler's signing string against the verifier.

Each drain stops on a wall-clock budget (see `DEFAULT_BATCH_BUDGET_MS`) so the serverless function never dies mid-batch and burns inbox attempt counts. A batch that stops early reports `exhaustedBudget` and logs a warning.

## Attempt state rules

- **Observed money is never dropped.** A part payment landing on an attempt that was already cancelled, expired or failed ranks _below_ the current status on the transition ladder. `resolveCollectionTransition` escalates that case to `review` instead of refusing it, so the order's `receivedAmount` is still refreshed. A full payment continues to settle such an attempt directly.
- **Reconciliation never re-opens a closed attempt.** `activeForCheckout` only ever moves to `false`; an order's unique active-for-checkout slot may already belong to a replacement attempt.
- **An attempt closes on its own deadline.** `isLocallyExpiredAttempt` expires an unpaid attempt once `expiresAt` passes, without waiting for the provider to agree. That unblocks `createReplacementAttempt` (which waits on `terminalConfirmedAt`) and releases the promo reservation. Money still wins: a later paid transition is accepted regardless.
- **A dead link is never advertised.** `BillingOrderView.checkoutUrl` is withheld once the active attempt's deadline has passed, so the checkout page cannot send anyone to an expired payment page. `attemptExpiresAt` is exposed so the client can say so.
- **A failed payment-link creation leaves the order `unpaid`.** No money was collected and the promo reservation was released, so there is nothing for an operator to decide. The diagnosis lives on the attempt (`createOutcome: 'definite_failure'` plus `lastProviderError`). Only genuine invariant violations — provider disagreement, transaction identity collisions, ledger mismatch — put an order into `review`.
- **`createOutcome: 'indeterminate'` is the dangerous one**, because a payable link may exist that we never recorded. `/admin/billing` counts these separately.

## Plan pricing

`plans.price` must be a whole number of dong and at least `VND_MINIMUM_PAYABLE` (2,000). The floor is enforced at the DTO and again on the Mongoose schema: a cheaper or fractional price quotes fine and then fails the order schema inside the create transaction, surfacing to the buyer as a 500.

## Configuration fences

`PAYOS_CREATE_ENABLED` and `ENTITLEMENT_AUTO_ACTIVATION_ENABLED` both default to OFF in production when unset. Enabling only the first collects money and grants nothing, so `npm run check:billing` fails that combination and runs as part of `vercel-build`. The same gate validates the single `PAYOS_CHECKSUM_KEY` and the `BILLING_WEBHOOK_PAYLOAD_KEYS` list for shape and duplicate `kid`s, refuses key material shared between verification and payload encryption, requires `ABUSE_SIGNAL_HASH_SECRET` wherever payments are enabled, and refuses a production deploy with payments enabled against a database whose name marks it as non-production.

## Operator surface

`/admin/billing` is the work queue for anything the pipeline parked: orders in review, part payments, unallocated overpayments, clawbacks, stuck webhook inbox rows, and inbound deliveries we could not read or authenticate. Refunds and chargebacks are recorded there; when `EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED` is on, recording one revokes **only** the grant that order created and the order lands on `revoked`. `review` is reserved for the case where money and entitlement genuinely disagree and no automation may close the gap — with auto-revocation off, or on a provider disagreement. `/admin/subscriptions` keeps a separate break-glass control that revokes an account's entire grant history.

Two transitions have no machine-checkable justification and therefore require an operator, a reason, and an audit row:

- **Overpayments.** Automation can see that a customer paid too much but must never decide what happens to the surplus, so `unallocated` is a queue with no automatic exit. `POST /api/admin/billing/orders/{orderId}/excess-resolution` is that exit (`refund`, `credit`, `write_off`, each with a required reason). The verdict is terminal: reconciliation writes the derived resolution through a filter that only matches the two states automation owns, so the next provider observation cannot reopen a closed case.
- **External money.** `POST /api/admin/billing/orders/{orderId}/external-adjustments` records money that moved outside the provider. Entitlement follows the net ledger — received plus signed adjustments against the order total — never the type of the latest event, so a reversed chargeback restores access and a second refund against an already-refunded order is refused.

`GET /api/admin/billing/webhooks` is the read model for inbound deliveries. It is the only path to a retained webhook body; retention that nothing can read is a liability with no upside. See `docs/BILLING_WEBHOOK_RUNBOOK.md` for the verification classes, retention and replay policy, and the key-rotation procedures.

## Admin grants

Admin grants use the same entitlement ledger writer as billing fulfillment. Revoke/restore operations append entitlement adjustments and rebuild `entitlementaccounts`; they do not create a second subscription record.

## Cutover

Run `npm run migrate:single-source-cutover` first. The command is dry-run by default. Production apply is a separate, explicitly approved maintenance operation and must run only after the canonical code release stops legacy writes.

The normative ownership rules are in `docs/architecture/source-of-truth-registry.md`.
