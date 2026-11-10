import { expect, test, type Page } from '@playwright/test';

/**
 * RIN-1473: the signed-out entry points to the guest PDF trial. The landing hero pill and
 * the public `/create` hub both open `/try/pdf` without a sign-in redirect; `/create/pdf`
 * still needs an account.
 */

const COPY = {
  vi: {
    heroPill: 'Thử với PDF của bạn – không cần tài khoản',
    hubCta: 'Thử với PDF của bạn – không cần tài khoản',
    hubTitle: 'Tạo quiz',
    tryPdfTitle: 'Tạo câu hỏi trắc nghiệm từ PDF, làm ngay',
  },
  en: {
    heroPill: 'Try it with your own PDF, no account needed',
    hubCta: 'Try it with your own PDF, no account needed',
    hubTitle: 'Create a quiz',
    tryPdfTitle: 'PDF to quiz generator: turn your PDF into a quiz now',
  },
} as const;

async function waitForHydration(page: Page, selector: ReturnType<Page['getByRole']>) {
  await expect
    .poll(() =>
      selector.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))),
    )
    .toBe(true);
}

test.describe('guest PDF entry points (RIN-1473) @critical-quiz', () => {
  for (const locale of ['vi', 'en'] as const) {
    const copy = COPY[locale];

    test(`the ${locale} landing hero opens the guest PDF page without sign-in`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      const pill = page
        .locator('#landing-main-content > section')
        .first()
        .getByRole('link', { name: copy.heroPill });
      await expect(pill).toHaveAttribute('href', `/${locale}/try/pdf?entry=landing`);
      await waitForHydration(page, pill);

      await pill.click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/try/pdf\\?entry=landing$`));
      await expect(page.getByRole('heading', { level: 1, name: copy.tryPdfTitle })).toBeVisible();
    });

    test(`the ${locale} /create hub is public and leads to the guest PDF page`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/create`);

      await expect(page).toHaveURL(new RegExp(`/${locale}/create$`));
      await expect(page.getByRole('heading', { level: 1, name: copy.hubTitle })).toBeVisible();
      const cta = page.getByRole('link', { name: copy.hubCta });
      await expect(cta).toHaveAttribute('href', `/${locale}/try/pdf?entry=create`);

      await cta.click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/try/pdf\\?entry=create$`));
      await expect(page.getByRole('heading', { level: 1, name: copy.tryPdfTitle })).toBeVisible();
    });
  }

  test('keeps /create/pdf behind sign-in', async ({ page }) => {
    await page.goto('/en/create/pdf');

    await expect(page).toHaveURL(/\/en\/login\?callbackUrl=%2Fcreate%2Fpdf$/);
  });
});
