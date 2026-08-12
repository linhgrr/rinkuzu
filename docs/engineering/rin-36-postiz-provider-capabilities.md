# RIN-36 Postiz provider capabilities

Checked: 2026-08-12 (Asia/Saigon)

Postiz surface: authenticated self-hosted Public API (`/api/public/v1`)

Safety: read-only verification; no publish, schedule, comment, reply, or DM action

## Connector contract

The admin-authenticated endpoint is `GET /api/admin/postiz` with these operations:

- `operation=capabilities`
- `operation=posts&integrationId=...&startDate=...&endDate=...`
- `operation=analytics&integrationId=...&postId=...&startDate=...&endDate=...&date=30`

It requires `POSTIZ_PUBLIC_API_URL`, `POSTIZ_API_KEY`, and the comma-separated
`POSTIZ_OWNED_INTEGRATION_IDS` server environment variables. The connector checks
the allowlist before any upstream request and then confirms the integration still
exists in the authenticated Postiz inventory.

The response never returns post content, integration/account labels, profiles,
pictures, audience identity, handles, email, or comment text. Missing provider
state, public URL, content ID, and timestamps are explicit `null` values. Empty
analytics are a structured `POSTIZ_ANALYTICS_UNAVAILABLE` error, not zero engagement.

## Capability matrix

| Capability                               | Threads                               | Telegram                              | Unsupported reason                                    |
| ---------------------------------------- | ------------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Owned post history/state                 | Supported                             | Supported                             | —                                                     |
| Aggregate post analytics                 | Supported when Postiz returns metrics | Supported when Postiz returns metrics | Empty provider result is explicitly unavailable       |
| Comment/reply history                    | Unsupported                           | Unsupported                           | No authenticated Postiz Public API endpoint           |
| Single owned-channel reply               | Unsupported/fail closed               | Unsupported/fail closed               | No provider-specific endpoint and authorization proof |
| Batch reply, auto-DM, third-party action | Prohibited                            | Prohibited                            | Outside RIN-36 scope                                  |

## Read-only provider verification

The authenticated integration inventory returned both approved owned IDs:

- Threads: `cmrxbd9bg0004li8fyg626pi7`
- Telegram: `cmrx2wuru0001ne81kz37lcys`

The authenticated history read for 2026-08-01 through 2026-08-13 reconciled the
two RIN-35 targets independently:

| Platform | Post ID                     | Provider state | Public URL | Provider analytics                 |
| -------- | --------------------------- | -------------- | ---------- | ---------------------------------- |
| Threads  | `cmspiyl7f0001l78g6k9p8tr4` | `DRAFT`        | `null`     | unavailable (HTTP 200 empty array) |
| Telegram | `cmspiyl910002l78gr1u935bk` | `DRAFT`        | `null`     | unavailable (HTTP 200 empty array) |

An integration-contract difference was observed and is covered by fixtures:
the live integration inventory uses `identifier`, while list-post integration
objects use `providerIdentifier`. Both map to the same constrained platform enum.

## Upstream blockers

Comments and replies require an authenticated Postiz Public API endpoint that
proves the requested item belongs to the configured owned integration and exposes
a provider-supported single reply operation. Until upstream supplies that contract,
these operations return `POSTIZ_CAPABILITY_UNSUPPORTED`; scraping and unsafe
provider-direct fallbacks are intentionally absent.
