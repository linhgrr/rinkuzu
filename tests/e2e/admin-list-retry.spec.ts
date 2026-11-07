import { expect, test, type Page, type Route } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * Retry on an admin list that failed to load (RIN-1166): ErrorState stays up with a
 * pending Retry until the refetch settles, with no skeleton in between, and a failed
 * refetch over a loaded users table keeps the rows.
 *
 * The admin login, gate and pages run for real. Only the list GET is answered by
 * `page.route`: a 500 envelope first, then the real response once the test releases it,
 * so the flow needs no fixture rows and reads no learner data.
 */

const SERVER_TEXT = 'Mongo timeout for learner secret@example.com';

const LISTS = [
  { name: 'quizzes', path: '/en/admin/quizzes', api: '/api/admin/quizzes', h1: 'Quiz Management' },
  {
    name: 'subscriptions',
    path: '/en/admin/subscriptions',
    api: '/api/admin/subscriptions',
    h1: 'Subscriptions',
  },
  { name: 'reports', path: '/en/admin/reports', api: '/api/admin/reports', h1: 'Quiz Reports' },
  { name: 'users', path: '/en/admin/users', api: '/api/admin/users', h1: 'User Management' },
] as const;

function fulfillServerError(route: Route): Promise<void> {
  return route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      error: { code: 'internal_error', detail: SERVER_TEXT, message: SERVER_TEXT },
    }),
  });
}

/** The first list GET fails; later ones wait for `release()`, then reach the real API. */
async function failThenHold(page: Page, api: string): Promise<{ release: () => void }> {
  let release: () => void = () => undefined;
  const released = new Promise<void>((done) => {
    release = done;
  });
  let hits = 0;
  await page.route(new RegExp(`${api}(\\?|$)`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    hits += 1;
    if (hits === 1) return fulfillServerError(route);
    await released;
    return route.fallback();
  });
  return { release };
}

/** ErrorState is the alert that holds a button; the route announcer is an alert too. */
function errorState(page: Page) {
  return page
    .locator('#app-main-content')
    .getByRole('alert')
    .filter({ has: page.locator('button') });
}

test.describe('admin list Retry', () => {
  for (const list of LISTS) {
    test(`${list.name}: Retry stays pending on ErrorState until the refetch settles @critical-admin-lists`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await withAccounts(testInfo, async ({ admin }) => {
        await login(page, admin);
        const { release } = await failThenHold(page, list.api);
        await page.goto(list.path);

        const alert = errorState(page);
        await expect(alert).toBeVisible({ timeout: 30_000 });
        await expect(alert).not.toContainText(SERVER_TEXT);
        await expect(page.getByRole('heading', { level: 1, name: list.h1 })).toBeVisible();

        // The pending button hides its label, so hold the button itself, not its name.
        const retry = alert.locator('button').first();
        await expect(retry).toHaveText('Retry');
        await retry.click();

        await expect(alert).toHaveAttribute('aria-busy', 'true');
        await expect(retry).toBeDisabled();
        await expect(page.locator('[aria-busy="true"][aria-label^="Loading"]')).toHaveCount(0);

        release();
        await expect(alert).toHaveCount(0, { timeout: 30_000 });
      });
    });
  }

  test('users: a failed refetch keeps the loaded table and shows an inline error @critical-admin-lists', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await withAccounts(testInfo, async ({ admin }) => {
      await login(page, admin);
      // Only the search refetch fails; the first page load is real.
      await page.route(/\/api\/admin\/users\?.*search=/, (route) =>
        route.request().method() === 'GET' ? fulfillServerError(route) : route.fallback(),
      );
      await page.goto('/en/admin/users');

      const main = page.locator('#app-main-content');
      await expect(main.getByText('Total Users').first()).toBeVisible({ timeout: 30_000 });

      const search = main.getByPlaceholder('Search users by email...');
      await search.fill('no-such-learner');
      await search.press('Enter');

      const alert = errorState(page);
      await expect(alert).toBeVisible({ timeout: 30_000 });
      await expect(alert).not.toContainText(SERVER_TEXT);
      await expect(main.getByText('Total Users').first()).toBeVisible();
      await expect(search).toBeVisible();
    });
  });
});
