# Responsive web delivery runbook

This is the reproducible delivery path for Rinkuzu's responsive web application. The
PWA is an installable capability of this same web build; it is not a separate mobile
application or store release.

## Pinned baseline

- Branch: `paperclip/autonomous-rinkuzu`
- Node.js: `22.23.1` (`.nvmrc` and `package.json#engines`)
- npm: `10.9.8` (`package.json#packageManager`)
- Install source: committed `package-lock.json`
- Build output: Next.js standalone server (`.next/standalone`)

Run every command from the repository root. Do not use the founder checkout.

## Local setup

1. Select Node.js `22.23.1` and verify it with `npm run check:node`.
2. Copy `.env.example` to a local, untracked `.env.local` and supply development-only
   values. Never commit credentials. At minimum, the application contract requires
   valid URLs for `MONGODB_URI`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, and
   `OBJECT_STORAGE_ENDPOINT_EXTERNAL`; authenticated, mail, billing, and adaptive
   flows require their corresponding variables from `.env.example`.
3. Install exactly from the lockfile with `npm ci`.
4. Start the responsive web application with `npm run dev`.

Use local or explicitly approved non-production dependencies. MongoDB, object storage,
the adaptive API, email, OAuth, billing, and analytics are external capabilities; a
successful bundle does not prove those integrations are live.

## Critical checks and production build

Run the cheap deterministic checks first:

```powershell
npm run check:node
npm run check:install
npm run check:routes
npm run typecheck
npm run typecheck:scripts
```

Then build with a complete release-candidate environment:

```powershell
$env:NODE_ENV = 'production'
npm run build
npm run start
```

`next.config.js` deliberately fails before compilation when
`OBJECT_STORAGE_ENDPOINT_EXTERNAL` is absent or invalid. Treat that as configuration
failure, not a build regression. On Windows, stop any server using `.next/standalone`
before rebuilding; an `EBUSY` cleanup failure means the build did not pass. Do not
delete shared output until the owning process and target path are verified.

After `npm run start`, smoke-test the candidate locally:

1. Open the canonical locale landing route at desktop and narrow mobile widths.
2. Verify sign-in and sign-up routes render without changing their approved visuals.
3. Verify `/manifest.json` and `/serwist/sw.js` return successfully over the same
   origin, and confirm installability in browser developer tools.
4. Exercise the issue-approved user outcome and its failure state against
   non-production dependencies.
5. Run the focused tests for every changed boundary. Run `npm run prepush:full` when
   preparing a commit intended as a release candidate.

PWA checks validate only installability and service-worker delivery. They do not imply
native packaging, app-store readiness, or complete offline support.

## Release-candidate record

Record the following in the release issue before asking for human approval:

- branch and full commit SHA;
- Node/npm versions and lockfile SHA-256;
- exact commands, timestamps, exit codes, and environment class (never secret values);
- responsive viewport and approved-outcome evidence;
- manifest/service-worker checks;
- which external integrations were exercised and which remain unverified;
- GitNexus `detect_changes --scope compare --base-ref master` output;
- known risks and the rollback commit.

Production credentials, deployment, traffic changes, user contact, and release
publication require explicit human approval.

## Rollback and recovery

1. Preserve the failed release logs and identify the last known-good deployed commit.
2. Have the human release owner redeploy that immutable commit with the previous
   approved environment configuration. Do not rewrite branch history.
3. If the failure is isolated to PWA caching, ship a reviewed forward fix to the
   service worker and verify update activation; do not promise immediate cache eviction
   on clients that have not reconnected.
4. Re-run the landing, authentication-render, manifest/service-worker, and approved
   outcome smoke checks after rollback.
5. Record the deployed SHA, recovery evidence, residual impact, and owner of any
   external follow-up.

Database migrations, destructive/unique/TTL index changes, credential rotation, and
production data repair are separate high-impact procedures. This runbook does not
authorize them.

## RIN-5 verification evidence (2026-08-11)

At commit `a362db7c`, Node `22.23.1` on Windows:

- Passed: `npm run check:node`
- Passed: `npm run check:install`
- Passed: `npm run check:routes`
- Passed: `npm run typecheck`
- Passed: `npm run typecheck:scripts`
- Blocked: `npm run build` first failed because
  `OBJECT_STORAGE_ENDPOINT_EXTERNAL` was absent.
- Blocked: with `NODE_ENV=production` and a non-secret local object-storage origin,
  the build reached output cleanup but failed with Windows `EBUSY` on
  `.next/standalone`. No Node process whose command line referenced this checkout was
  present at inspection time. This is not passing production-build evidence and must
  be rerun in an isolated workspace or after the external lock is identified.
