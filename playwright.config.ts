import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['PORT'] ?? 3000);
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${port}`;
const isCI = Boolean(process.env['CI']);
const usesExternalServer = Boolean(process.env['PLAYWRIGHT_BASE_URL']);
const runsFullDeviceMatrix = process.env['PLAYWRIGHT_FULL_MATRIX'] === 'true';
const usesSystemChrome = process.env['PLAYWRIGHT_USE_SYSTEM_CHROME'] === 'true';
const criticalFlowPattern = /@critical-(?:auth|quiz|adaptive|subscription|admin)\b/;
const fakeAdaptiveBaseUrl = 'http://127.0.0.1:8000';
const systemChrome = usesSystemChrome ? { channel: 'chrome' as const } : {};

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: isCI ? 1 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI
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
            reuseExistingServer: false,
            timeout: 30 * 1000,
            stdout: 'pipe',
            stderr: 'pipe',
          },
          {
            command: `npm run start -- --port ${port}`,
            url: baseURL,
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
