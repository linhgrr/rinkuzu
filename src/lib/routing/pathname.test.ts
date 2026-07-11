import { describe, expect, it } from 'vitest';
import { shouldHideGlobalFooter, toBrowserPath, toIntlHref } from './pathname';

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
