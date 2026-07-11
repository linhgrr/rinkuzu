import { expect, test } from '@playwright/test';

const email = process.env['E2E_USER_EMAIL'] ?? '';
const password = process.env['E2E_USER_PASSWORD'] ?? '';
const hasCreds = email.length > 0 && password.length > 0;
const p95BudgetMs = Number(process.env['AUTH_PERF_P95_MS'] ?? 4000);
const samples = Math.max(1, Number(process.env['AUTH_PERF_SAMPLES'] ?? 3));

test.describe('credentials login performance', () => {
  test.skip(!hasCreds, 'E2E auth credentials are not configured');

  test(`warm click-to-dashboard p95 ≤ ${p95BudgetMs}ms`, async ({ page }) => {
    // Warm navigation so first-compile cost is excluded from samples.
    await page.goto('/en/login');
    await page.getByRole('button', { name: /sign in/i }).waitFor();

    const durations: number[] = [];

    for (let i = 0; i < samples; i += 1) {
      await page.context().clearCookies();
      await page.goto('/en/login');
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/^password$/i).fill(password);

      const started = Date.now();
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/en\/dashboard(?:\?|$)/, { timeout: 30_000 });
      durations.push(Date.now() - started);
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor((durations.length - 1) * 0.5)] ?? 0;
    const p95 = durations[Math.floor((durations.length - 1) * 0.95)] ?? 0;

    // eslint-disable-next-line no-console -- performance smoke metric for CI logs
    console.log(
      JSON.stringify({
        metric: 'credentials_click_to_dashboard_ms',
        samples: durations,
        p50,
        p95,
        budgetP95: p95BudgetMs,
      }),
    );

    expect(
      p95,
      `p95 ${p95}ms exceeded budget ${p95BudgetMs}ms (samples=${durations.join(',')})`,
    ).toBeLessThanOrEqual(p95BudgetMs);
  });
});
