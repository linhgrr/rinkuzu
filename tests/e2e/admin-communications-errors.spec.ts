import { expect, test, type Page } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * Load errors on the admin campaign and feedback conversation pages (RIN-827, RIN-846).
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
  },
  {
    name: 'feedback conversation',
    path: `/en/admin/feedback/${FAKE_ID}`,
    api: `/api/admin/feedback/${FAKE_ID}`,
    copy: 'Could not load the conversation.',
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
    test(`${target.name}: localized error box with code and a working Retry @critical-admin-communications`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await withAccounts(testInfo, async ({ admin }) => {
        await login(page, admin);
        const hits = await failDetailRoute(page, target.api);
        await page.goto(target.path);

        const alert = page.getByRole('alert').filter({ hasText: target.copy });
        await expect(alert).toBeVisible({ timeout: 30_000 });
        await expect(alert).toContainText('Code: internal_error');
        await expect(alert).not.toContainText(SERVER_TEXT);

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
        await Promise.all([
          page.waitForRequest(
            (request) =>
              new URL(request.url()).pathname === target.api && request.method() === 'GET',
          ),
          alert.getByRole('button', { name: 'Retry' }).click(),
        ]);
        expect(hits()).toBeGreaterThan(before);
        await expect(alert).toBeVisible();
      });
    });
  }
});
