import { describe, expect, it } from 'vitest';
import {
  getLocaleFromPath,
  getMarketingHeaderPosition,
  shouldHideGlobalFooter,
  stripLocaleFromPath,
  toBrowserPath,
  toIntlHref,
} from './pathname';

describe('toIntlHref / toBrowserPath', () => {
  it('strips locale prefixes for next-intl navigation', () => {
    expect(toIntlHref('/en/dashboard')).toBe('/dashboard');
    expect(toIntlHref('/vi/login?callbackUrl=%2Fdashboard')).toBe(
      '/login?callbackUrl=%2Fdashboard',
    );
    expect(toIntlHref('/dashboard')).toBe('/dashboard');
  });

  it('always prefixes locale for browser paths', () => {
    expect(toBrowserPath('/dashboard', 'en')).toBe('/en/dashboard');
    expect(toBrowserPath('/dashboard', 'vi')).toBe('/vi/dashboard');
    expect(toBrowserPath('/', 'en')).toBe('/en');
    expect(toBrowserPath('/', 'vi')).toBe('/vi');
  });

  it('extracts supported locales and falls back on unprefixed root paths', () => {
    expect(getLocaleFromPath('/vi/dashboard')).toEqual({
      locale: 'vi',
      pathWithoutLocale: '/dashboard',
    });
    expect(getLocaleFromPath('/')).toEqual({ locale: 'vi', pathWithoutLocale: '/' });
  });
});

describe('stripLocaleFromPath / getLocaleFromPath', () => {
  it('handles localized root paths', () => {
    expect(stripLocaleFromPath('/en')).toBe('/');
    expect(stripLocaleFromPath('/vi')).toBe('/');
    expect(getLocaleFromPath('/en')).toEqual({ locale: 'en', pathWithoutLocale: '/' });
    expect(getLocaleFromPath('/vi')).toEqual({ locale: 'vi', pathWithoutLocale: '/' });
  });

  it('handles localized nested paths', () => {
    expect(stripLocaleFromPath('/en/dashboard')).toBe('/dashboard');
    expect(stripLocaleFromPath('/vi/adaptive/exercise')).toBe('/adaptive/exercise');
    expect(getLocaleFromPath('/en/dashboard')).toEqual({
      locale: 'en',
      pathWithoutLocale: '/dashboard',
    });
    expect(getLocaleFromPath('/vi/adaptive/exercise')).toEqual({
      locale: 'vi',
      pathWithoutLocale: '/adaptive/exercise',
    });
  });

  it('uses default locale when path has no locale prefix', () => {
    expect(stripLocaleFromPath('/dashboard')).toBe('/dashboard');
    expect(stripLocaleFromPath('/')).toBe('/');
    expect(getLocaleFromPath('/dashboard')).toEqual({
      locale: 'vi',
      pathWithoutLocale: '/dashboard',
    });
    expect(getLocaleFromPath('/')).toEqual({ locale: 'vi', pathWithoutLocale: '/' });
  });

  it('normalizes trailing slashes', () => {
    expect(stripLocaleFromPath('/en/')).toBe('/');
    expect(stripLocaleFromPath('/vi/dashboard/')).toBe('/dashboard');
    expect(getLocaleFromPath('/en/')).toEqual({ locale: 'en', pathWithoutLocale: '/' });
    expect(getLocaleFromPath('/vi/dashboard/')).toEqual({
      locale: 'vi',
      pathWithoutLocale: '/dashboard',
    });
  });
});

describe('shouldHideGlobalFooter', () => {
  it.each([
    '/',
    '/en',
    '/vi/',
    '/en/about',
    '/en/pricing',
    '/en/faq',
    '/en/blog',
    '/en/blog/article-slug',
    '/en/privacy',
    '/en/terms',
    '/en/cookies',
    '/en/contact',
  ])('shows the footer on public marketing path %s', (pathname) => {
    expect(shouldHideGlobalFooter(pathname)).toBe(false);
  });

  it.each([
    '/en/dashboard',
    '/en/adaptive',
    '/en/my-quizzes',
    '/en/profile',
    '/en/login',
    '/en/register',
    '/en/check-email',
    '/en/forgot-password',
    '/en/reset-password',
    '/en/verify-email',
  ])('hides the footer outside the public marketing allowlist for %s', (pathname) => {
    expect(shouldHideGlobalFooter(pathname)).toBe(true);
  });
});

describe('getMarketingHeaderPosition (RIN-1519)', () => {
  it.each([
    ['/blog', 'blog_header'],
    ['/en/blog', 'blog_header'],
    ['/vi/blog/some-post', 'blog_header'],
    ['/en/blog/authors', 'blog_header'],
    ['/en/pricing', 'pricing_header'],
    ['/pricing/', 'pricing_header'],
    ['/en/about', 'content_header'],
    ['/vi/faq', 'content_header'],
    ['/en/contact', 'content_header'],
    ['/en/privacy', 'content_header'],
    ['/en/terms', 'content_header'],
    ['/en/cookies', 'content_header'],
  ] as const)('shows the header on %s as %s', (pathname, position) => {
    expect(getMarketingHeaderPosition(pathname)).toBe(position);
  });

  it.each([
    '/',
    '/en',
    '/vi',
    '/en/login',
    '/en/register',
    '/en/forgot-password',
    '/en/try',
    '/en/blogger',
    '/en/dashboard',
  ])('keeps %s without the header', (pathname) => {
    expect(getMarketingHeaderPosition(pathname)).toBeNull();
  });
});
