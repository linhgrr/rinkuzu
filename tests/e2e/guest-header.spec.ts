import { expect, test } from '@playwright/test';

/**
 * RIN-958: a signed-out guest must get Sign in (back to the same page) in the
 * app header, never the account menu or a Log out that ends on a raw 500.
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
] as const;

const COPY = {
  vi: {
    signIn: 'Đăng nhập',
    logout: 'Đăng xuất',
    openMenu: 'Mở menu',
    userMenu: 'Mở menu người dùng',
  },
  en: { signIn: 'Sign In', logout: 'Logout', openMenu: 'Open menu', userMenu: 'Toggle user menu' },
} as const;

test.describe('guest app header (RIN-958) @critical-auth', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`a guest gets Sign in back to the page and no Log out (${locale})`, async ({
      page,
    }, testInfo) => {
      const copy = COPY[locale];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(`/${locale}/explore`);

        const header = page.getByRole('banner');
        const signIn = header.getByRole('link', { name: copy.signIn, exact: true });
        await expect(signIn).toBeVisible();
        await expect(signIn).toHaveAttribute('href', `/${locale}/login?callbackUrl=%2Fexplore`);
        await expect(page.getByRole('button', { name: copy.logout })).toHaveCount(0);
        await expect(header.getByRole('button', { name: copy.userMenu })).toHaveCount(0);

        if (viewport.width < 1024) {
          await header.getByRole('button', { name: copy.openMenu, exact: true }).click();
          await expect(page.locator('#mobile-app-menu')).toBeVisible();
          await expect(page.getByRole('button', { name: copy.logout })).toHaveCount(0);
          await expect(
            page.locator('#mobile-app-menu').getByRole('link', { name: copy.signIn, exact: true }),
          ).toBeVisible();
        }

        await testInfo.attach(`guest-header-${locale}-${viewport.width}.png`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
      }

      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto(`/${locale}/explore`);
      await page.getByRole('banner').getByRole('link', { name: copy.signIn, exact: true }).click();
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === `/${locale}/login` && url.searchParams.get('callbackUrl') === '/explore',
      );
    });
  }

  test('logging out without a session redirects home instead of failing', async ({
    request,
    baseURL,
  }) => {
    // A browser form POST is same-origin; the proxy CSRF guard 403s requests without Origin.
    const response = await request.post('/api/session/logout', {
      form: { locale: 'en' },
      headers: { origin: new URL(baseURL ?? 'http://localhost:3000').origin },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(new URL(response.headers()['location'] ?? '').pathname).toBe('/en');
  });
});
