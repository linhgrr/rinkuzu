# Mobile Web/PWA Delivery Runbook

## Scope and release boundary

Rinkuzu's supported mobile target is the existing responsive Next.js web application and installable PWA. There is no native Android, iOS, Expo, or Capacitor target in this repository.

The release-candidate journey owned by RIN-5 is:

`PDF upload accepted -> draft generated -> review/publish -> quiz opened -> first question answered`

This runbook makes the local artifact and internal/staging checks reproducible. It does not authorize a public release, production credentials, user contact, paid services, database changes, or changes to login/signup, landing, Android, or Gradle assets.

## Reproducible source and toolchain

Use only the dedicated checkout and branch:

```powershell
Set-Location 'C:\Users\Tuan Linh\Downloads\Projects\Working\rinkuzu_prj\rinkuzu-paperclip'
git switch paperclip/autonomous-rinkuzu
git status --short --branch
git merge --ff-only master
git rev-parse HEAD
```

Stop if the worktree is not clean before the merge. Do not use the founder checkout at `..\rinkuzu`.

The repository pins:

- Node.js `22.23.1` in `.nvmrc` and `package.json`.
- npm `10.9.8` in `package.json`.
- dependencies in `package-lock.json`.

Verify and install from the lockfile:

```powershell
node --version
npm --version
npm ci
npm run check:node
npm run check:toolchain
npm run check:install
```

`npm ci` runs the normal Husky prepare step. Never bypass hooks.

## Build environment

The production bundle validates the complete server environment while collecting page data. A build therefore needs valid shapes for MongoDB, auth, the companion API, object storage, mail, and PayOS even when the external systems are not contacted.

For an offline artifact check, set ephemeral non-production values in the current shell. Generate fresh secrets rather than copying committed values:

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/rinkuzu-build'
$env:AUTH_SECRET=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:AUTH_URL='http://127.0.0.1:3000'
$env:AUTH_TRUST_HOST='true'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000'
$env:NEXT_PUBLIC_API_URL='http://127.0.0.1:8000'
$env:SESSION_MAX_AGE_SECONDS='28800'
$env:SESSION_UPDATE_AGE_SECONDS='3600'
$env:AUTH_LOCKOUT_MAX_ATTEMPTS='5'
$env:AUTH_LOCKOUT_WINDOW_MINUTES='15'
$env:AUTH_LOCKOUT_DURATION_MINUTES='15'
$env:ADAPTIVE_PROXY_TIMEOUT_MS='60000'
$env:INTERNAL_SERVICE_TOKEN=[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:OBJECT_STORAGE_ENDPOINT_EXTERNAL='http://127.0.0.1:9000'
$env:OBJECT_STORAGE_REGION='auto'
$env:OBJECT_STORAGE_ADDRESSING_STYLE='path'
$env:OBJECT_STORAGE_ACCESS_KEY='offline-build-access-key'
$env:OBJECT_STORAGE_SECRET_KEY='offline-build-secret-key'
$env:OBJECT_STORAGE_BUCKET='offline-build-bucket'
$env:MAIL_FROM='noreply@example.com'
$env:RESEND_API_KEY='offline-build-resend-key'
$env:PAYOS_CLIENT_ID='offline-build-payos-client'
$env:PAYOS_API_KEY='offline-build-payos-api-key'
$env:PAYOS_CHECKSUM_KEY='offline-build-payos-checksum-key'
$env:PAYOS_CREATE_ENABLED='false'
$env:ENTITLEMENT_AUTO_ACTIVATION_ENABLED='false'
$env:EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED='false'
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
```

These values are build fixtures only. They must never be deployed. A staging or production candidate must receive real values from its approved secret manager and must not persist them in Git, shell history, logs, screenshots, or the release evidence package.

The authoritative validation rules are in `src/lib/env.ts`; `.env.example` is the operator checklist. The build fails closed when required values are missing or malformed.

## Critical local checks

Run targeted checks first:

```powershell
npm run check:routes
npm run check:architecture
npm exec -- vitest run tests/pwa-runtime-caching.test.ts src/app/sitemap.test.ts tests/ui/figma-color-token-contract.test.ts tests/ui/checkout-design-contract.test.ts
npm run typecheck
```

Then create the production artifact:

```powershell
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
npm run build
```

A successful build currently produces 132 static pages and a Serwist service worker with 137 precache entries. An unavailable local MongoDB can emit `sitemap: quiz generation failed` while the build still exits successfully. Treat that line as a warning, not live sitemap evidence.

For a change that will be pushed, also run the repository-required hook gates. The current pre-push contract is:

```powershell
npm run prepush:full
```

Do not label unrun browser, live-service, performance, security, or deployment checks as passing.

## Release-candidate sequence

1. Record the exact commit with `git rev-parse HEAD` and confirm `git status --short` is empty.
2. Confirm the GitNexus index is current. Before symbol edits, obtain a trustworthy upstream impact result with direct callers, flows/modules, and risk. Stop before HIGH or CRITICAL edits.
3. Run targeted checks for every changed boundary, then the required hook gates.
4. Build once with release-equivalent configuration. Record only variable names and configuration fingerprints, never secret values.
5. Deploy to human-approved staging using an immutable commit or image identifier. Do not reuse mutable `latest` tags as evidence.
6. With an authorized non-sensitive PDF and consenting test account, verify at a mobile viewport:
   - authentication and entitlement boundaries;
   - upload acceptance without duplicate quota use;
   - draft generation, review, and publish;
   - quiz open and first-answer persistence after refresh/reopen;
   - one bounded retry for a deliberately induced transient processing failure, if that recovery exists;
   - no PDF bytes, file name, extracted content, questions, answers, email, tokens, or direct database IDs in analytics.
7. Verify real staging object storage and companion `/api/v1` processing rather than substituting local mocks.
8. Capture release evidence: commit/image ID, command results, viewport/browser, redacted configuration fingerprint, test PDF identifier, timestamps, event schema/delivery, known warnings, and rollback target.
9. Request explicit human approval before any external beta or production release.

## External dependencies and evidence limits

| Dependency                             | Needed for                                              | Local artifact evidence                                                                        | Release-candidate requirement                                                          |
| -------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| MongoDB                                | users, quizzes, drafts, progress, billing, sitemap data | Schema/configuration and compilation only; loopback refusal is tolerated by sitemap generation | Authorized non-production database, migrations/index state checked, no PII in evidence |
| S3-compatible storage                  | PDF upload and signed reads                             | URL/configuration validation only                                                              | Real staging bucket, scoped credentials, upload/read/delete smoke                      |
| Companion API at `NEXT_PUBLIC_API_URL` | extraction, generation, adaptive processing             | Contract checks only                                                                           | Real staging `/api/v1` health and one complete PDF job                                 |
| Auth.js and optional Google OAuth      | authenticated journey                                   | Compilation and unit checks                                                                    | Approved callback origins and test account; no production account changes              |
| Resend/mail                            | verification and recovery mail                          | Configuration shape only                                                                       | Approved sandbox/test delivery if the tested journey needs email                       |
| PayOS                                  | paid entitlements                                       | Disabled for the mobile activation candidate                                                   | Keep creation/auto-activation/revocation disabled unless separately approved           |
| PostHog/GA                             | consented funnel measurement                            | Event definitions only                                                                         | Consent-gated non-production delivery and deduplication; content-free allow-list       |

The local build is implementation evidence, not proof that these services work or that users activate.

## Rollback and recovery

No database migration, entitlement change, quota-policy change, or storage rewrite is part of this delivery-path stabilization.

Before deployment:

- retain the previously verified immutable commit/image and its configuration fingerprint;
- record who can switch traffic or restore the previous deployment;
- confirm any staging data created by the smoke PDF can be identified and safely deleted;
- do not overwrite the previous artifact or rotate credentials as part of the release.

If the candidate fails before traffic:

1. Stop the candidate deployment.
2. Restore the previous immutable artifact with its prior approved configuration.
3. Re-run the smallest auth, PWA shell, and quiz-open smoke.
4. Remove only the known staging test PDF/draft/quiz records after resolving exact identifiers and ownership. Do not run broad cleanup commands.

If a PWA candidate reached clients:

1. Redeploy the previous artifact under a new immutable release identifier so the service worker update is detectable.
2. Verify the service worker and precache manifest update on a clean profile and on an existing installed-PWA profile.
3. If a client remains pinned, use documented browser/site-data recovery for the test device; do not silently instruct real users without approved support messaging.

If PDF processing fails after upload acceptance, preserve idempotency: retry only the recorded job/draft, confirm quota was not consumed twice, and delete an orphaned object only after the database and object ownership are proven.

## RIN-5 evidence record

On 2026-08-11 the autonomous branch was fast-forwarded from `c7e99cc4` to local `master` `a16ee41b`. GitNexus `detect_changes(compare, master)` before the sync reported 9 files, 13 symbols, zero affected processes, and LOW risk. The product/growth documentation commit `43e80f3d` landed concurrently afterward and contains no application symbol changes.

Post-sync checks on the application tree:

- `npm run check:node` passed.
- `npm run check:toolchain` initially failed on Windows because the script tried to execute the
  `npm` shim directly. GitNexus reported LOW risk for `actualNpm`: zero direct callers, affected
  flows, or affected modules. The check now invokes the npm CLI through the pinned Node process.
- The focused cross-platform toolchain regression passed: 1 file, 1 test.
- `npm run check:install` passed.
- `npm run check:routes` passed.
- `npm run check:architecture` passed.
- Focused Vitest run passed: 4 files, 17 tests.
- `npm run typecheck` passed.
- `npm run build` passed only after the complete non-secret fixture environment above was supplied; it generated 132 static pages and 137 precache entries.
- A later rebuild attempt was evidence-bound blocked because a concurrent `next build` already owned
  the shared `.next` directory; it was not reported as a pass and the existing process was not
  terminated.
- The build logged the known refused loopback MongoDB sitemap warning; live sitemap data remains unverified.

GitNexus caution: post-sync name/file-scoped `impact` and `context` queries for two changed master symbols returned unrelated repository-wide callers and a CRITICAL score, while exact-UID retries returned `not found`. No RIN-5 function/class/method edit proceeded. The change-diff result is retained as the scoped sync evidence; future symbol work must repair or obtain a trustworthy exact impact result first.

Unavailable in this environment: browser E2E, real object storage, real companion processing, OAuth/mail/payment delivery, analytics delivery, Lighthouse, deployment smoke, Atlas query plans, and production gates.
