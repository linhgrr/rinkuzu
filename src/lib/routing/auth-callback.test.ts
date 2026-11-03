import { describe, expect, it } from 'vitest';
import { forwardableAuthCallback, resolveAuthCallback, withAuthCallback } from './auth-callback';

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

describe('forwardableAuthCallback', () => {
  it('keeps safe same-origin paths without the locale prefix', () => {
    expect(forwardableAuthCallback('/quiz/nhap-mon-ai')).toBe('/quiz/nhap-mon-ai');
    expect(forwardableAuthCallback('/vi/quiz/nhap-mon-ai')).toBe('/quiz/nhap-mon-ai');
    expect(forwardableAuthCallback('/review?tab=due')).toBe('/review?tab=due');
  });

  it('drops missing, external, blocked and dashboard values', () => {
    expect(forwardableAuthCallback(null)).toBeNull();
    expect(forwardableAuthCallback('')).toBeNull();
    expect(forwardableAuthCallback('//evil.com')).toBeNull();
    expect(forwardableAuthCallback('https://evil.com')).toBeNull();
    expect(forwardableAuthCallback('/en/register')).toBeNull();
    expect(forwardableAuthCallback('/dashboard')).toBeNull();
  });
});

describe('withAuthCallback', () => {
  it('appends an encoded callbackUrl only when it is safe', () => {
    expect(withAuthCallback('/register', '/quiz/a')).toBe('/register?callbackUrl=%2Fquiz%2Fa');
    expect(withAuthCallback('/login', '/vi/review?tab=due')).toBe(
      '/login?callbackUrl=%2Freview%3Ftab%3Ddue',
    );
    expect(withAuthCallback('/register', 'https://evil.com')).toBe('/register');
    expect(withAuthCallback('/register', null)).toBe('/register');
  });
});
