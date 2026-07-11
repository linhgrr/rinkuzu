import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['PORT'] ?? 3000);
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://127.0.0.1:${port}`;
const skipWebServer = process.env['PLAYWRIGHT_SKIP_WEBSERVER'] === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        // Prefer production server so Server Actions / AUTH_URL match a real deploy.
        command: `npm run start -- --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        timeout: 120 * 1000,
        env: {
          ...process.env,
          AUTH_URL: process.env['AUTH_URL'] ?? baseURL,
          NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'] ?? baseURL,
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
