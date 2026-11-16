import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-1770: a request with no session cookie gets the cached signed-out twin of
 * `/premium-quizzes`, which holds nobody's data; a signed-in request keeps the
 * per-request page with only its own session.
 */

const NAMES = ['E2E Admin User', 'E2E Regular User'] as const;

async function html(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  return {
    body: await response.text(),
    cacheControl: response.headers()['cache-control'] ?? '',
    cdn: response.headers()['cloudflare-cdn-cache-control'] ?? '',
    setCookie: response.headers()['set-cookie'] ?? '',
  };
}

test.describe('signed-out premium catalog from the cache (RIN-1770)', () => {
  test('the signed-out HTML is shared and session-free; each session sees only itself', async ({
    browser,
    playwright,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    const origin = baseURL ?? 'http://localhost:3000';

    await withAccounts(testInfo, async ({ admin, regular }) => {
      const guest = await playwright.request.newContext({ baseURL: origin });
      const signedOut = await html(guest, '/vi/premium-quizzes');
      const withQuery = await html(guest, '/vi/premium-quizzes?q=toan&page=2');
      const internal = await guest.get('/vi/signed-out/premium-quizzes', { maxRedirects: 0 });
      await guest.dispose();

      for (const page of [signedOut, withQuery]) {
        // Served by the ISR twin, not rendered per request.
        expect(page.cacheControl).toContain('s-maxage=600');
        expect(page.cdn).toBe('public, max-age=300, stale-while-revalidate=600');
        expect(page.setCookie).toBe('');
        expect(page.body).toMatch(/rel="canonical" href="[^"]*\/vi\/premium-quizzes"/);
      }
      // The internal twin path is never served by itself.
      expect(internal.status()).toBe(307);
      expect(new URL(internal.headers()['location'] ?? '', origin).pathname).toBe(
        '/vi/premium-quizzes',
      );

      const sessions = [];
      for (const user of [admin, regular]) {
        const context = await browser.newContext({ baseURL: origin });
        const page = await context.newPage();
        await login(page, user);
        sessions.push({ user, ...(await html(context.request, '/vi/premium-quizzes')) });
        await context.close();
      }

      for (const forbidden of [admin.email, regular.email, ...NAMES]) {
        expect(signedOut.body).not.toContain(forbidden);
      }
      for (const [index, session] of sessions.entries()) {
        const other = sessions[1 - index];
        expect(session.cacheControl).not.toContain('s-maxage');
        expect(session.cdn).toBe('no-store');
        expect(session.body).toContain(session.user.email);
        expect(session.body).not.toContain(other?.user.email ?? 'missing');
      }
    });
  });
});
