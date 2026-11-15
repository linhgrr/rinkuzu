import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// The twin rewrite runs before any auth or locale work; stub both.
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }));
vi.mock('next-auth', () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));

const { default: proxy } = await import('./proxy');

const ORIGIN = 'https://www.rinkuzu.app';

async function run(path: string, init: { method?: string; cookie?: string } = {}) {
  const request = new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers: init.cookie ? { cookie: init.cookie } : {},
  });
  const response = await proxy(request, {} as NextFetchEvent);
  if (!response) throw new Error('proxy returned no response');
  return response;
}

describe('proxy: signed-out twins (RIN-1646)', () => {
  it.each([
    ['/vi/explore', '/vi/signed-out/explore'],
    ['/en/explore', '/en/signed-out/explore'],
    ['/vi/explore/toan-hoc', '/vi/signed-out/explore/toan-hoc'],
    ['/vi/explore?q=sinh&type=quiz', '/vi/signed-out/explore?q=sinh&type=quiz'],
  ])('rewrites a cookie-less GET of %s to the cached twin', async (path, twin) => {
    const response = await run(path, { cookie: 'NEXT_LOCALE=vi' });

    expect(response.headers.get('x-middleware-rewrite')).toBe(`${ORIGIN}${twin}`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it.each(['__Secure-authjs.session-token=x', 'authjs.session-token.0=not-a-jwt'])(
    'keeps the dynamic route for a request with %s',
    async (cookie) => {
      const response = await run('/vi/explore', { cookie });

      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    },
  );

  it('keeps the dynamic route for a POST', async () => {
    const response = await run('/vi/explore', { method: 'POST' });

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('marks the rewritten request so a proxied re-entry is served, not redirected', async () => {
    const rewrite = await run('/vi/explore');
    expect(rewrite.headers.get('x-middleware-request-x-rinkuzu-signed-out-twin')).toBe('1');

    const request = new NextRequest(`${ORIGIN}/vi/signed-out/explore`, {
      headers: { 'x-rinkuzu-signed-out-twin': '1' },
    });
    const reentry = await proxy(request, {} as NextFetchEvent);

    expect(reentry?.headers.get('location')).toBeNull();
    expect(reentry?.headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects a direct request for the twin to its public URL', async () => {
    const response = await run('/vi/signed-out/explore/toan-hoc?q=a');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/vi/explore/toan-hoc?q=a`);
  });
});

describe('proxy: Cloudflare-CDN-Cache-Control (RIN-1679)', () => {
  const header = async (path: string, init: { method?: string; cookie?: string } = {}) =>
    (await run(path, init)).headers.get('cloudflare-cdn-cache-control');

  it('is public for a cookie-less public page and the explore twin', async () => {
    expect(await header('/vi/about')).toBe('public, max-age=300, stale-while-revalidate=600');
    expect(await header('/vi/explore')).toBe('public, max-age=300, stale-while-revalidate=600');
  });

  it('is no-store with a session cookie, a POST, or a non-allowlisted page', async () => {
    expect(await header('/vi/about', { cookie: 'authjs.session-token=junk' })).toBe('no-store');
    expect(await header('/vi/about', { method: 'POST' })).toBe('no-store');
    expect(await header('/vi/quiz/some-slug')).toBe('no-store');
  });

  it('is no-store on a redirect and absent on /api', async () => {
    expect(await header('/vi/signed-out/explore')).toBe('no-store');
    expect(await header('/api/ready')).toBeNull();
  });
});

describe('proxy: proxied twin pass keeps the public header (RIN-1679)', () => {
  it('judges a marked twin request by its public URL, an unmarked one as no-store', async () => {
    const marked = await proxy(
      new NextRequest(`${ORIGIN}/vi/signed-out/explore`, {
        headers: { 'x-rinkuzu-signed-out-twin': '1' },
      }),
      {} as NextFetchEvent,
    );
    expect(marked?.headers.get('cloudflare-cdn-cache-control')).toBe(
      'public, max-age=300, stale-while-revalidate=600',
    );

    const direct = await run('/vi/signed-out/explore');
    expect(direct.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
  });
});
