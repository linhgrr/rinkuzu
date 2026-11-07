import { expect, test, type Page } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * Load errors on the admin campaign, feedback conversation and support ticket pages
 * (RIN-827, RIN-846). Since RIN-1159 each keeps an h1 and a Back link, and shows no
 * "Code:" line: the code is for logs, not admins.
 *
 * The admin login, gate and pages run for real. Only the detail GET is answered
 * by `page.route` with a 500 envelope, so the flow needs no campaign or
 * conversation rows and reads no learner data.
 */

const FAKE_ID = '6a8ed209f04328ac17443d92';
const SERVER_TEXT = 'Mongo timeout for learner secret@example.com';

const PAGES = [
  {
    name: 'campaign',
    path: `/en/admin/campaigns/${FAKE_ID}`,
    api: `/api/admin/campaigns/${FAKE_ID}`,
    copy: 'Could not load the campaign.',
    heading: 'Campaign',
    back: { name: 'Back to campaigns', href: '/en/admin/campaigns' },
  },
  {
    name: 'feedback conversation',
    path: `/en/admin/feedback/${FAKE_ID}`,
    api: `/api/admin/feedback/${FAKE_ID}`,
    copy: 'Could not load the conversation.',
    heading: 'Feedback conversation',
    back: { name: 'Back to feedback', href: '/en/admin/feedback' },
  },
  {
    name: 'support ticket',
    path: `/en/admin/support/${FAKE_ID}`,
    api: `/api/admin/support/${FAKE_ID}`,
    copy: 'Could not load this support ticket.',
    heading: 'Support request',
    back: { name: 'Back to requests', href: '/en/admin/support' },
  },
] as const;

/** Fails every GET of the detail route; returns how many it answered. */
async function failDetailRoute(page: Page, api: string): Promise<() => number> {
  let hits = 0;
  await page.route(`**${api}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    hits += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'internal_error', detail: SERVER_TEXT, message: SERVER_TEXT },
      }),
    });
  });
  return () => hits;
}

test.describe('admin communications load errors', () => {
  for (const target of PAGES) {
    test(`${target.name}: h1, Back link, localized error box without a code, and a working Retry @critical-admin-communications`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await withAccounts(testInfo, async ({ admin }) => {
        await login(page, admin);
        const hits = await failDetailRoute(page, target.api);
        await page.goto(target.path);

        const alert = page.getByRole('alert').filter({ hasText: target.copy });
        await expect(alert).toBeVisible({ timeout: 30_000 });
        await expect(alert).not.toContainText('Code:');
        await expect(alert).not.toContainText(SERVER_TEXT);
        await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
        await expect(
          page.locator('#app-main-content').getByRole('link', { name: target.back.name }),
        ).toHaveAttribute('href', target.back.href);

        // Readable on the device the project runs: the box stays inside the viewport.
        const box = await alert.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect(viewport).not.toBeNull();
        if (box && viewport) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        }

        const before = hits();
        await alert.getByRole('button', { name: 'Retry' }).click();
        // The route handler counts the hit after the browser sends the request, so a
        // synchronous read right after waitForRequest can still see the old count (RIN-878).
        await expect.poll(hits).toBeGreaterThan(before);
        await expect(alert).toBeVisible();
      });
    });
  }
});
