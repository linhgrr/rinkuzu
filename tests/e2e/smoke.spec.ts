import { expect, test } from '@playwright/test';

test.describe('marketing smoke', () => {
  test('loads localized about page', async ({ page }) => {
    const response = await page.goto('/en/about');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('robots endpoint is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBeTruthy();
  });
});
