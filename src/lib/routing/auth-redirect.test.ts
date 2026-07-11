import { describe, expect, it } from 'vitest';

import { resolveSafeAuthRedirect } from '@/lib/routing/auth-redirect';

describe('resolveSafeAuthRedirect', () => {
  it.each([
    [null, 'vi', '/dashboard'],
    ['', 'en', '/en/dashboard'],
    ['https://evil.example/path', 'vi', '/dashboard'],
    ['//evil.example/path', 'en', '/en/dashboard'],
    ['/\\evil.example/path', 'vi', '/dashboard'],
    ['/login', 'vi', '/dashboard'],
    ['/en/login?next=/profile', 'en', '/en/dashboard'],
    ['/register', 'vi', '/dashboard'],
    ['/en', 'en', '/en/dashboard'],
    ['/api/auth/signin', 'vi', '/dashboard'],
  ])('falls back for unsafe or looping target %s', (raw, locale, expected) => {
    expect(resolveSafeAuthRedirect(raw, locale)).toBe(expected);
  });

  it.each([
    ['/dashboard', 'vi', '/dashboard'],
    ['/en/profile?tab=security#password', 'en', '/en/profile?tab=security#password'],
    ['/bookmarks', 'vi', '/bookmarks'],
    ['/en/my-quizzes?page=2', 'en', '/en/my-quizzes?page=2'],
  ])('preserves valid internal target %s', (raw, locale, expected) => {
    expect(resolveSafeAuthRedirect(raw, locale)).toBe(expected);
  });
});
