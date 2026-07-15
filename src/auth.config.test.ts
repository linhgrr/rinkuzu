import { describe, expect, it } from 'vitest';

import { resolveAuthRedirectTarget } from '@/auth.config';

describe('resolveAuthRedirectTarget', () => {
  const baseUrl = 'https://www.rinkuzu.app';

  it('returns an absolute same-origin URL for relative paths', () => {
    expect(resolveAuthRedirectTarget('/en/dashboard', baseUrl)).toBe(
      'https://www.rinkuzu.app/en/dashboard',
    );
  });

  it('rejects absolute external URLs', () => {
    expect(resolveAuthRedirectTarget('https://evil.example/phish', baseUrl)).toBe(
      'https://www.rinkuzu.app/vi/dashboard',
    );
  });

  it('rejects auth endpoint loops', () => {
    expect(resolveAuthRedirectTarget('/login', baseUrl)).toBe(
      'https://www.rinkuzu.app/vi/dashboard',
    );
    expect(resolveAuthRedirectTarget('/en/register', baseUrl)).toBe(
      'https://www.rinkuzu.app/en/dashboard',
    );
  });

  it('accepts same-origin absolute URLs', () => {
    expect(resolveAuthRedirectTarget('https://www.rinkuzu.app/en/profile', baseUrl)).toBe(
      'https://www.rinkuzu.app/en/profile',
    );
  });

  it('preserves localized home redirects used by sign-out', () => {
    expect(resolveAuthRedirectTarget('/en', baseUrl)).toBe('https://www.rinkuzu.app/en');
    expect(resolveAuthRedirectTarget('https://www.rinkuzu.app/vi', baseUrl)).toBe(
      'https://www.rinkuzu.app/vi',
    );
  });
});
