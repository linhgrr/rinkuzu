import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['PORT'] ?? 3000);
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${port}`;
const isCI = Boolean(process.env['CI']);
const usesExternalServer = Boolean(process.env['PLAYWRIGHT_BASE_URL']);
const runsFullDeviceMatrix = process.env['PLAYWRIGHT_FULL_MATRIX'] === 'true';
const usesSystemChrome = process.env['PLAYWRIGHT_USE_SYSTEM_CHROME'] === 'true';
const criticalFlowPattern = /@critical-(?:auth|quiz|adaptive|subscription|admin)\b/;
const fakeAdaptiveBaseUrl = 'http://127.0.0.1:8000';
/**
 * The token the app and the stubbed adaptive service authenticate to each other
 * with, pinned for both rather than inherited.
 *
 * Next loads `.env`, so the app would otherwise use the developer's real
 * service token, while the fake service is a plain Node process that never
 * reads `.env` and falls back to the CI fixture. The two then disagree, every
 * proxied call is rejected as unauthorised, and the upload flow reports
 * "Backend is offline" — which reads like a service that is down rather than a
 * token mismatch. Non-secret fixture; matches the CI, Docker and vitest values.
 */
const e2eServiceToken = 'rinkuzu-ci-fixture-0123456789abcdef-token';

/**
 * The database the suite seeds, asserts against, and wipes between flows.
 *
 * Pinned rather than inherited, for the same reason as the token above. Next
 * loads `.env` for the server it starts, while the runner process loads
 * nothing: left to their own devices the app writes to whatever `.env` names
 * — on a developer machine, their real database — while the specs read an
 * empty `rinkuzu_ci` and report the mismatch as a wall of assertion failures.
 * Passing one value to both is what keeps them on the same data.
 *
 * A replica set, because the billing flows the suite exercises open
 * transactions, which a standalone mongod refuses. An explicit
 * `MONGODB_URI` still wins so CI keeps supplying its own; the spec itself
 * refuses any database but `rinkuzu_ci` on a local host, so an ambient value
 * pointing somewhere real aborts the run instead of writing to it.
 */
const e2eMongoUri =
  process.env['MONGODB_URI'] ??
  'mongodb://127.0.0.1:27017/rinkuzu_ci?replicaSet=rs0&directConnection=true';
// The specs read it from the environment, and every worker re-loads this file.
process.env['MONGODB_URI'] = e2eMongoUri;
const systemChrome = usesSystemChrome ? { channel: 'chrome' as const } : {};

/**
 * Whether this process is one shard of a sharded run.
 *
 * A shard must emit a blob report and nothing else that claims to be final: an
 * HTML or JUnit file written by one shard describes a third of the suite while
 * looking exactly like a description of all of it. The blobs are merged
 * afterwards by a job that runs without this set, which is also how
 * `merge-reports --config` finds the output paths for the real reports.
 *
 * An explicit variable rather than a test on `--shard`, because the flag is not
 * visible here and a report format that silently depended on argv would be the
 * harder thing to debug.
 */
const emitsBlobReport = process.env['PLAYWRIGHT_BLOB_REPORT'] === '1';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: emitsBlobReport
    ? [['blob'], ['github']]
    : isCI
      ? [
          ['github'],
          ['json', { outputFile: 'test-results/playwright-results.json' }],
          ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
          ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ]
      : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    // Production PWA requests can otherwise bypass page.route() through the
    // service worker and reach real external services during mocked E2E flows.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  ...(usesExternalServer
    ? {}
    : {
        webServer: [
          {
            command: 'node tests/e2e/support/fake-adaptive-server.mjs',
            url: `${fakeAdaptiveBaseUrl}/__e2e/health`,
            env: { INTERNAL_SERVICE_TOKEN: e2eServiceToken },
            reuseExistingServer: false,
            timeout: 30 * 1000,
            stdout: 'pipe',
            stderr: 'pipe',
          },
          {
            command: `npm run start -- --port ${port}`,
            url: baseURL,
            // The suite has to be runnable on a port other than the one `.env`
            // pins, because a developer's 3000 is routinely already taken. The
            // server is started as a child process, so it inherits `.env`
            // unless told otherwise: without these the app would issue auth
            // callbacks and absolute links to a port nothing is listening on,
            // and every login in the suite fails for a reason that looks
            // nothing like a port conflict.
            env: {
              HOSTNAME: '127.0.0.1',
              MONGODB_URI: e2eMongoUri,
              AUTH_URL: baseURL,
              AUTH_TRUST_HOST: 'true',
              NEXT_PUBLIC_SITE_URL: baseURL,
              INTERNAL_SERVICE_TOKEN: e2eServiceToken,
            },
            reuseExistingServer: false,
            timeout: 120 * 1000,
            stdout: 'pipe',
            stderr: 'pipe',
          },
        ],
      }),
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], ...systemChrome } },
    {
      name: 'mobile-chromium-critical',
      ...(runsFullDeviceMatrix ? {} : { grep: criticalFlowPattern }),
      use: { ...devices['Pixel 5'], ...systemChrome },
    },
    {
      name: 'mobile-webkit-critical',
      ...(runsFullDeviceMatrix ? {} : { grep: criticalFlowPattern }),
      use: { ...devices['iPhone 13'] },
    },
  ],
});
