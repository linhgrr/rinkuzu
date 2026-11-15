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

describe('proxy: signed-out quiz landing twin (RIN-1647)', () => {
  it.each([
    ['/vi/quiz/toan-12', '/vi/signed-out/quiz/toan-12'],
    ['/en/quiz/toan-12', '/en/signed-out/quiz/toan-12'],
    ['/vi/quiz/toan-12?', '/vi/signed-out/quiz/toan-12'],
  ])('rewrites a cookie-less GET of %s to the cached twin', async (path, twin) => {
    const response = await run(path, { cookie: 'NEXT_LOCALE=vi' });

    expect(response.headers.get('x-middleware-rewrite')).toBe(`${ORIGIN}${twin}`);
    expect(response.headers.get('x-middleware-request-x-rinkuzu-signed-out-twin')).toBe('1');
  });

  it.each([
    '/vi/quiz/toan-12?mode=quick',
    '/vi/quiz/toan-12?mode=full',
    '/vi/quiz/toan-12?retryOf=6a8ed20a3d0a1892cacdfe0b',
    '/vi/quiz/toan-12?entry=quiz_landing',
    '/vi/quiz/toan-12?entry=hub&topic=toan-hoc',
    '/vi/quiz/toan-12?view=play',
    '/vi/quiz/toan-12?utm_source=threads',
  ])('keeps the dynamic route for %s (the query changes the page)', async (path) => {
    const response = await run(path);

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it.each(['/vi/quiz/toan-12/flashcards', '/vi/quiz/toan-12/result', '/vi/quiz'])(
    'keeps the dynamic route for %s',
    async (path) => {
      const response = await run(path);

      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    },
  );

  it.each(['__Secure-authjs.session-token=x', 'authjs.session-token=not-a-jwt'])(
    'keeps the dynamic route for a signed-in request with %s',
    async (cookie) => {
      const response = await run('/vi/quiz/toan-12', { cookie });

      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    },
  );

  it('keeps the dynamic route for a POST', async () => {
    const response = await run('/vi/quiz/toan-12', { method: 'POST' });

    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('redirects a direct request for the quiz twin to its public URL', async () => {
    const response = await run('/vi/signed-out/quiz/toan-12');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/vi/quiz/toan-12`);
  });
});
