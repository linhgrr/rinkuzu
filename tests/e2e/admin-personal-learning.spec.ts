import { expect, test, type Page } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * The admin Personalized Learning workspace on /admin/stats (RIN-399 AC 7).
 *
 * The page, its BFF route and the admin gate run for real; the adaptive API
 * behind the route is `support/fake-personal-learning.mjs`, which answers each
 * window with its own aggregate counts. The only rows seeded are the two
 * accounts that sign in, and no learner data is read or asserted on.
 */

const SUMMARY_ROUTE = '/api/admin/personal-learning/summary';

/** What the fake service returns per window, as the page words it. */
const WINDOW_FIGURES = [
  { label: '7 days', key: '7d', jobs: '3 of 4', period: '2026-10-28' },
  { label: '30 days', key: '30d', jobs: '9 of 12', period: '2026-10-19' },
  { label: '90 days', key: '90d', jobs: '31 of 40', period: '2026-09-30' },
  { label: 'All time', key: 'all', jobs: '97 of 120', period: '2026-10' },
] as const;

function jobsDetailFor(jobs: string): string {
  return `${jobs} jobs started in this window completed`;
}

function summaryResponse(page: Page, key: string) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`${SUMMARY_ROUTE}?window=${key}`) &&
      response.request().method() === 'GET',
  );
}

test.describe('admin personal-learning dashboard', () => {
  test('renders aggregate totals and trend, and refetches per window @critical-admin-personal-learning', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withAccounts(testInfo, async ({ admin }) => {
      await login(page, admin);
      // The workspace nav renders only once the overview stats have loaded.
      const stats = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/admin/stats' &&
          response.request().method() === 'GET',
        { timeout: 30_000 },
      );
      await page.goto('/en/admin/stats');
      expect((await stats).status()).toBe(200);

      const initial = summaryResponse(page, '30d');
      await page
        .getByRole('navigation', { name: 'Statistics workspace' })
        .getByRole('button', { name: 'Personalized Learning' })
        .click();
      expect((await initial).status()).toBe(200);

      await expect(
        page.getByRole('heading', { name: 'Personalized Learning', exact: true }),
      ).toBeVisible();
      const filter = page.getByRole('group', { name: 'Time window' });
      await expect(filter.getByRole('button', { name: '30 days' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByText('Active learners', { exact: true }).first()).toBeVisible();
      const chart = page.getByRole('img', { name: 'Trend over time' });
      await expect(chart).toBeVisible();

      // The section opens on 30 days; then every window in turn, 30 days
      // included, so each one is fetched by a click rather than inherited.
      const opening = WINDOW_FIGURES.find((entry) => entry.key === '30d');
      await expect(page.getByText(jobsDetailFor(opening?.jobs ?? ''))).toBeVisible();
      for (const figures of WINDOW_FIGURES) {
        const refetch = summaryResponse(page, figures.key);
        await filter.getByRole('button', { name: figures.label }).click();
        expect((await refetch).status()).toBe(200);
        await expect(filter.getByRole('button', { name: figures.label })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(page.getByText(jobsDetailFor(figures.jobs))).toBeVisible();
        await expect(chart.getByText(figures.period, { exact: true })).toBeVisible();
        for (const other of WINDOW_FIGURES.filter((entry) => entry !== figures)) {
          await expect(page.getByText(jobsDetailFor(other.jobs))).toHaveCount(0);
        }
      }
    });
  });

  test('keeps non-admins and anonymous visitors out @critical-admin-personal-learning-gate', async ({
    page,
  }, testInfo) => {
    await withAccounts(testInfo, async ({ regular }) => {
      await page.goto('/en/admin/stats');
      await expect(page).toHaveURL(/\/en\/login\?(?:.*&)?callbackUrl=%2Fadmin%2Fstats/);
      const anonymousApi = await page.request.get(`${SUMMARY_ROUTE}?window=30d`);
      expect(anonymousApi.status()).toBe(401);

      await login(page, regular);
      await page.goto('/en/admin/stats');
      // The proxy sends non-admin users to localized home; an authenticated
      // home page then canonicalizes to dashboard by design.
      await expect(page).toHaveURL(/\/en\/dashboard(?:[/?#]|$)/);
      await expect(
        page.getByRole('heading', { name: 'Personalized Learning', exact: true }),
      ).toHaveCount(0);

      const forbidden = await page.evaluate(async (route) => {
        const response = await fetch(`${route}?window=30d`);
        return { body: await response.json(), status: response.status };
      }, SUMMARY_ROUTE);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toMatchObject({ error: { code: 'forbidden' }, success: false });
    });
  });
});
