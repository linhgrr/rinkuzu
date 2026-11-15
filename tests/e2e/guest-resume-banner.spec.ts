import { expect, test, type Page } from '@playwright/test';

/**
 * RIN-1714: a returning guest sees "your result is still here" on the landing page,
 * the guest tools and Explore; closing it sticks across a reload. The claim is seeded
 * in localStorage (fake data); no account and no server round trip are involved.
 */

const CLAIMS_KEY = 'rinkuzu.guestClaims.v1';

async function seedClaim(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify([
        {
          attemptId: 'fake-attempt-1',
          token: 'T'.repeat(43),
          quizSlug: 'fake-quiz',
          takenAt: Date.now() - 2 * 60 * 60 * 1000,
          score: 71,
          quizTitle: 'Fake quiz title',
        },
      ]),
    );
  }, CLAIMS_KEY);
}

test.describe('guest resume banner (RIN-1714)', () => {
  test('landing: shown for a claim, closed for good, focus on the main landmark', async ({
    page,
  }) => {
    await seedClaim(page);
    await page.goto('/vi');

    const banner = page.getByRole('region', { name: 'Kết quả bài quiz đã lưu trên thiết bị này' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Kết quả của bạn vẫn còn: 71%');
    await expect(banner).toContainText('Fake quiz title');
    await expect(banner.getByRole('button', { name: 'Lưu với Google' })).toBeVisible();
    await expect(banner.getByRole('link', { name: 'Xem lại' })).toHaveAttribute(
      'href',
      '/vi/quiz/fake-quiz/result?attemptId=fake-attempt-1&score=71',
    );

    await banner.getByRole('button', { name: 'Đóng thông báo kết quả' }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator('#landing-main-content')).toBeFocused();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: /Kết quả bài quiz đã lưu/ })).toHaveCount(0);
  });

  test('with no claim nothing is added to the page', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Quiz result saved on this device' }),
    ).toHaveCount(0);
  });

  for (const path of ['/en/explore', '/en/try/pdf', '/en/try/text']) {
    test(`${path}: shown in flow under the header, never fixed`, async ({ page }) => {
      await seedClaim(page);
      await page.goto(path);

      const banner = page.getByRole('region', { name: 'Quiz result saved on this device' });
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Your result is still here: 71%');
      expect(await banner.evaluate((el) => getComputedStyle(el).position)).toBe('static');
    });
  }
});
