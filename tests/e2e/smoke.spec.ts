import { expect, test } from '@playwright/test';

test.describe('marketing smoke', () => {
  test('loads localized about page', async ({ page }) => {
    const response = await page.goto('/en/about');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  for (const [locale, otherLocale] of [
    ['en', 'vi'],
    ['vi', 'en'],
  ] as const) {
    // RIN-408: the force-static homepage must not fall back to /vi links on /en.
    test(`static homepage links stay on /${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}`);
      expect(response?.ok()).toBeTruthy();

      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href') ?? ''));

      expect(hrefs.some((href) => href.startsWith(`/${locale}/register`))).toBeTruthy();
      expect(
        hrefs.filter((href) => href === `/${otherLocale}` || href.startsWith(`/${otherLocale}/`)),
      ).toEqual([]);
    });
  }

  test('robots endpoint is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBeTruthy();
  });
});
