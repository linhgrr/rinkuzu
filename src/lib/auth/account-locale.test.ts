import { describe, expect, it } from 'vitest';

import { resolveAccountLocale } from '@/lib/auth/account-locale';

function jar(values: Record<string, string>) {
  return {
    get: (name: string) => (name in values ? { value: values[name] ?? '' } : undefined),
  };
}

describe('account locale', () => {
  it('accepts only supported locale codes', () => {
    expect(resolveAccountLocale({ explicit: 'en' })).toBe('en');
    expect(resolveAccountLocale({ explicit: 'vi' })).toBe('vi');
    expect(resolveAccountLocale({ explicit: 'fr' })).toBeNull();
    expect(resolveAccountLocale({ explicit: 'EN' })).toBeNull();
    expect(resolveAccountLocale({ explicit: 1 })).toBeNull();
  });

  it('reads the locale prefix of a path or absolute URL', () => {
    const fromReferer = (referer: string | null) => resolveAccountLocale({ referer });
    expect(fromReferer('/en/quiz/fake-slug')).toBe('en');
    expect(fromReferer('https://www.rinkuzu.app/vi/register?callbackUrl=%2Fen')).toBe('vi');
    expect(fromReferer('https://accounts.google.com/')).toBeNull();
    expect(fromReferer('/dashboard')).toBeNull();
    expect(fromReferer('http://[bad')).toBeNull();
    expect(fromReferer(null)).toBeNull();
  });

  it('prefers the explicit value, then the referer, then the callback cookie, then NEXT_LOCALE', () => {
    const cookies = jar({
      'authjs.callback-url': 'http://localhost:3000/vi/dashboard',
      NEXT_LOCALE: 'vi',
    });
    expect(
      resolveAccountLocale({ explicit: 'en', referer: 'https://x.test/vi/register', cookies }),
    ).toBe('en');
    expect(
      resolveAccountLocale({ explicit: 'xx', referer: 'https://x.test/en/register', cookies }),
    ).toBe('en');
    expect(resolveAccountLocale({ referer: 'https://accounts.google.com/', cookies })).toBe('vi');
    expect(
      resolveAccountLocale({ cookies: jar({ '__Secure-authjs.callback-url': '/en/dashboard' }) }),
    ).toBe('en');
    expect(resolveAccountLocale({ cookies: jar({ NEXT_LOCALE: 'en' }) })).toBe('en');
  });

  it('returns null when nothing in the request names a locale', () => {
    expect(resolveAccountLocale({})).toBeNull();
    expect(resolveAccountLocale({ referer: '/login', cookies: jar({ NEXT_LOCALE: 'de' }) })).toBe(
      null,
    );
  });
});
