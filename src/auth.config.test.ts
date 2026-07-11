import { describe, expect, it } from 'vitest';

import { resolveAuthRedirectTarget } from '@/auth.config';

describe('resolveAuthRedirectTarget', () => {
  const baseUrl = 'https://www.rinkuzu.app';

  it('keeps same-origin relative paths', () => {
    expect(resolveAuthRedirectTarget('/en/dashboard', baseUrl)).toBe('/en/dashboard');
  });

  it('rejects absolute external URLs', () => {
    expect(resolveAuthRedirectTarget('https://evil.example/phish', baseUrl)).toBe('/dashboard');
  });

  it('rejects auth endpoint loops', () => {
    expect(resolveAuthRedirectTarget('/login', baseUrl)).toBe('/dashboard');
    expect(resolveAuthRedirectTarget('/en/register', baseUrl)).toBe('/en/dashboard');
  });

  it('accepts same-origin absolute URLs', () => {
    expect(resolveAuthRedirectTarget('https://www.rinkuzu.app/en/profile', baseUrl)).toBe(
      '/en/profile',
    );
  });
});
