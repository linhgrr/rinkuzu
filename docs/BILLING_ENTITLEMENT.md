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

## Admin grants

Admin grants use the same entitlement ledger writer as billing fulfillment. Revoke/restore operations append entitlement adjustments and rebuild `entitlementaccounts`; they do not create a second subscription record.

## Cutover

Run `npm run migrate:single-source-cutover` first. The command is dry-run by default. Production apply is a separate, explicitly approved maintenance operation and must run only after the canonical code release stops legacy writes.

The normative ownership rules are in `docs/architecture/source-of-truth-registry.md`.
