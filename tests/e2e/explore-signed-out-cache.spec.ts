import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, withAccounts } from './support/admin-accounts';

/**
 * RIN-1646 (spec RIN-1642 AC 1 and AC 3): a request with no session cookie
 * gets the cached signed-out twin of `/explore`, which holds nobody's data;
 * a signed-in request keeps the per-request page with only its own session.
 */

const NAMES = ['E2E Admin User', 'E2E Regular User'] as const;

async function html(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), path).toBe(200);
  return { body: await response.text(), cacheControl: response.headers()['cache-control'] ?? '' };
}

test.describe('signed-out explore from the cache (RIN-1646)', () => {
  test('the signed-out HTML is shared and session-free; each session sees only itself', async ({
    browser,
    playwright,
    baseURL,
  }, testInfo) => {
    test.setTimeout(90_000);
    const origin = baseURL ?? 'http://localhost:3000';

    await withAccounts(testInfo, async ({ admin, regular }) => {
      const guest = await playwright.request.newContext({ baseURL: origin });
      const signedOut = await html(guest, '/vi/explore');
      const topicMiss = await guest.get('/vi/explore/khong-co-chu-de-nay');
      const internal = await guest.get('/vi/signed-out/explore', { maxRedirects: 0 });
      await guest.dispose();

      // Served by the ISR twin, not rendered per request.
      expect(signedOut.cacheControl).toContain('s-maxage=600');
      expect(signedOut.body).toContain('<link rel="canonical" href=');
      expect(signedOut.body).toMatch(/rel="canonical" href="[^"]*\/vi\/explore"/);
      expect(topicMiss.status()).toBe(404);
      // The internal twin path is never served by itself.
      expect(internal.status()).toBe(307);
      expect(new URL(internal.headers()['location'] ?? '', origin).pathname).toBe('/vi/explore');

      const sessions = [];
      for (const user of [admin, regular]) {
        const context = await browser.newContext({ baseURL: origin });
        const page = await context.newPage();
        await login(page, user);
        sessions.push({ user, ...(await html(context.request, '/vi/explore')) });
        await context.close();
      }

      for (const forbidden of [admin.email, regular.email, ...NAMES]) {
        expect(signedOut.body).not.toContain(forbidden);
      }
      for (const [index, session] of sessions.entries()) {
        const other = sessions[1 - index];
        expect(session.cacheControl).not.toContain('s-maxage');
        expect(session.body).toContain(session.user.email);
        expect(session.body).not.toContain(other?.user.email ?? 'missing');
      }
    });
  });
});
