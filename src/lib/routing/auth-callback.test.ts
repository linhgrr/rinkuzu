import { describe, expect, it } from 'vitest';
import { resolveAuthCallback } from './auth-callback';

describe('resolveAuthCallback', () => {
  it('defaults to dashboard for missing or unsafe values', () => {
    expect(resolveAuthCallback(null, 'en')).toEqual({
      intlHref: '/dashboard',
      browserUrl: '/en/dashboard',
    });
    expect(resolveAuthCallback('//evil.com', 'vi')).toEqual({
      intlHref: '/dashboard',
      browserUrl: '/vi/dashboard',
    });
    expect(resolveAuthCallback('/login', 'en')).toEqual({
      intlHref: '/dashboard',
      browserUrl: '/en/dashboard',
    });
  });

  it('accepts both prefixed and unprefixed app paths', () => {
    expect(resolveAuthCallback('/en/dashboard', 'en')).toEqual({
      intlHref: '/dashboard',
      browserUrl: '/en/dashboard',
    });
    expect(resolveAuthCallback('/dashboard', 'en')).toEqual({
      intlHref: '/dashboard',
      browserUrl: '/en/dashboard',
    });
    expect(resolveAuthCallback('/review?tab=due', 'vi')).toEqual({
      intlHref: '/review?tab=due',
      browserUrl: '/vi/review?tab=due',
    });
  });
});
