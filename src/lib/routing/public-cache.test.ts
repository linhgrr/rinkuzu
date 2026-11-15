import { describe, expect, it } from 'vitest';
import {
  cdnCacheControlFor,
  publicPathForInternalTwin,
  publicPathname,
  signedOutTwinPath,
  signedOutTwinQuizPath,
} from './public-cache';

const CDN_PUBLIC_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';
const CDN_NO_STORE = 'no-store';

describe('signedOutTwinPath', () => {
  const noCookies: string[] = [];

  it.each([
    ['/vi/explore', '/vi/signed-out/explore'],
    ['/en/explore', '/en/signed-out/explore'],
    ['/vi/explore/', '/vi/signed-out/explore'],
    ['/vi/explore/toan-hoc', '/vi/signed-out/explore/toan-hoc'],
    ['/en/explore/toan-hoc', '/en/signed-out/explore/toan-hoc'],
  ])('rewrites a signed-out GET of %s to %s', (pathname, twin) => {
    expect(signedOutTwinPath('GET', pathname, noCookies)).toBe(twin);
    expect(signedOutTwinPath('HEAD', pathname, noCookies)).toBe(twin);
  });

  it.each([
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.session-token.0',
    '__Secure-authjs.session-token.1',
  ])('treats %s as a session without decoding it', (name) => {
    expect(signedOutTwinPath('GET', '/vi/explore', ['NEXT_LOCALE', name])).toBeNull();
  });

  it.each([[['NEXT_LOCALE']], [['authjs.csrf-token', 'authjs.callback-url']]])(
    'finds no session in %j',
    (names) => {
      expect(signedOutTwinPath('GET', '/vi/explore', names)).toBe('/vi/signed-out/explore');
    },
  );

  it.each(['/vi/explore', '/vi/explore/toan-hoc'])(
    'keeps %s dynamic when any session cookie is present, valid or not',
    (pathname) => {
      expect(signedOutTwinPath('GET', pathname, ['__Secure-authjs.session-token'])).toBeNull();
      expect(signedOutTwinPath('GET', pathname, ['authjs.session-token.0'])).toBeNull();
    },
  );

  it.each(['POST', 'PUT', 'DELETE'])('leaves a %s unchanged', (method) => {
    expect(signedOutTwinPath(method, '/vi/explore', noCookies)).toBeNull();
  });

  it.each([
    '/explore',
    '/de/explore',
    '/vi/explorer',
    '/vi/explore/a/b',
    '/vi/dashboard',
    '/vi/quiz/abc',
    '/vi/signed-out/explore',
    '/api/explore',
  ])('leaves %s unchanged', (pathname) => {
    expect(signedOutTwinPath('GET', pathname, noCookies)).toBeNull();
  });
});

describe('publicPathForInternalTwin', () => {
  it.each([
    ['/vi/signed-out/explore', '/vi/explore'],
    ['/en/signed-out/explore/toan-hoc', '/en/explore/toan-hoc'],
    ['/vi/signed-out', '/vi'],
  ])('sends a direct request for %s to %s', (pathname, publicPath) => {
    expect(publicPathForInternalTwin(pathname)).toBe(publicPath);
  });

  it.each(['/vi/explore', '/vi/signed-outx', '/signed-out/explore'])('ignores %s', (pathname) => {
    expect(publicPathForInternalTwin(pathname)).toBeNull();
  });
});

describe('publicPathname', () => {
  it.each([
    ['/signed-out/explore', '/explore'],
    ['/signed-out/explore/toan-hoc', '/explore/toan-hoc'],
    ['/signed-out', '/'],
    ['/explore', '/explore'],
    ['/signed-outx', '/signed-outx'],
    ['/', '/'],
  ])('reports %s as %s', (pathname, expected) => {
    expect(publicPathname(pathname)).toBe(expected);
  });
});

describe('cdnCacheControlFor (RIN-1679)', () => {
  const base = { method: 'GET', cookieNames: [] as string[], status: 200, setsCookie: false };
  const decide = (over: Partial<Parameters<typeof cdnCacheControlFor>[0]> & { pathname: string }) =>
    cdnCacheControlFor({ ...base, ...over });

  it.each([
    '/vi',
    '/en',
    '/vi/about',
    '/en/faq',
    '/vi/contact',
    '/vi/pricing',
    '/vi/privacy',
    '/vi/terms',
    '/vi/cookies',
    '/vi/blog',
    '/vi/blog/some-post',
    '/en/blog/a/b',
    '/vi/try',
    '/vi/try/pdf',
    '/vi/try/text',
    '/vi/explore',
    '/vi/explore/toan-hoc',
    '/vi/explore/',
  ])('marks a cookie-less GET of %s public', (pathname) => {
    expect(decide({ pathname })).toBe(CDN_PUBLIC_CACHE_CONTROL);
    expect(decide({ pathname, method: 'HEAD' })).toBe(CDN_PUBLIC_CACHE_CONTROL);
  });

  it.each(['authjs.session-token', '__Secure-authjs.session-token.0'])(
    'is no-store with the session cookie %s, even a junk one',
    (name) => {
      expect(decide({ pathname: '/vi/explore', cookieNames: ['NEXT_LOCALE', name] })).toBe(
        CDN_NO_STORE,
      );
    },
  );

  it('ignores non-session cookies', () => {
    expect(decide({ pathname: '/vi/about', cookieNames: ['authjs.csrf-token'] })).toBe(
      CDN_PUBLIC_CACHE_CONTROL,
    );
  });

  it.each([
    ['POST', '/vi/explore'],
    ['GET', '/vi/dashboard'],
    ['GET', '/vi/quiz/some-slug'],
    ['GET', '/vi/explore/a/b'],
    ['GET', '/vi/try/other'],
    ['GET', '/vi/signed-out/explore'],
    ['GET', '/api/health'],
    ['GET', '/'],
    ['GET', '/fr/about'],
  ])('is no-store for %s %s', (method, pathname) => {
    expect(decide({ method, pathname })).toBe(CDN_NO_STORE);
  });

  it('is no-store for a redirect or a response that sets a cookie', () => {
    expect(decide({ pathname: '/vi/about', status: 307 })).toBe(CDN_NO_STORE);
    expect(decide({ pathname: '/vi/about', setsCookie: true })).toBe(CDN_NO_STORE);
  });
});

describe('signedOutTwinQuizPath', () => {
  it('builds the internal twin path of a quiz page', () => {
    expect(signedOutTwinQuizPath('vi', 'toan-12')).toBe('/vi/signed-out/quiz/toan-12');
    expect(publicPathForInternalTwin(signedOutTwinQuizPath('en', 'toan-12'))).toBe(
      '/en/quiz/toan-12',
    );
  });
});
