import { describe, expect, it } from 'vitest';
import { forwardableAuthCallback, resolveAuthCallback, withAuthCallback } from './auth-callback';

describe('resolveAuthCallback', () => {
  // RIN-913: with no destination, sign-in lands on /start, which sends a new
  // learner into the starter quiz and everyone else on to /dashboard.
  it('defaults to the post-sign-in landing for missing, unsafe or blocked values', () => {
    expect(resolveAuthCallback(null, 'en')).toEqual({
      intlHref: '/start',
      browserUrl: '/en/start',
    });
    expect(resolveAuthCallback('', 'vi')).toEqual({ intlHref: '/start', browserUrl: '/vi/start' });
    expect(resolveAuthCallback('//evil.com', 'vi')).toEqual({
      intlHref: '/start',
      browserUrl: '/vi/start',
    });
    expect(resolveAuthCallback('https://evil.com', 'vi').intlHref).toBe('/start');
    expect(resolveAuthCallback('/login', 'en')).toEqual({
      intlHref: '/start',
      browserUrl: '/en/start',
    });
    expect(resolveAuthCallback('/vi/register', 'vi').intlHref).toBe('/start');
    expect(resolveAuthCallback('/', 'en').intlHref).toBe('/start');
  });

  it('treats an explicit /dashboard as no destination (the signed-out dashboard guard sends it)', () => {
    expect(resolveAuthCallback('/en/dashboard', 'en')).toEqual({
      intlHref: '/start',
      browserUrl: '/en/start',
    });
    expect(resolveAuthCallback('/dashboard', 'vi')).toEqual({
      intlHref: '/start',
      browserUrl: '/vi/start',
    });
    expect(resolveAuthCallback('/start', 'en').intlHref).toBe('/start');
  });

  it('lets every other explicit destination win (RIN-773 quiz, RIN-747 premium, adaptive, admin)', () => {
    expect(resolveAuthCallback('/quiz/nhap-mon-ai', 'vi')).toEqual({
      intlHref: '/quiz/nhap-mon-ai',
      browserUrl: '/vi/quiz/nhap-mon-ai',
    });
    expect(resolveAuthCallback('/en/quiz/premium-quiz', 'en').intlHref).toBe('/quiz/premium-quiz');
    expect(resolveAuthCallback('/adaptive/upload', 'vi').intlHref).toBe('/adaptive/upload');
    expect(resolveAuthCallback('/admin/stats', 'vi').intlHref).toBe('/admin/stats');
    expect(resolveAuthCallback('/dashboard/settings', 'en').intlHref).toBe('/dashboard/settings');
  });

  it('accepts both prefixed and unprefixed app paths', () => {
    expect(resolveAuthCallback('/en/profile', 'en')).toEqual({
      intlHref: '/profile',
      browserUrl: '/en/profile',
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

  it('drops missing, external, blocked, dashboard and start values', () => {
    expect(forwardableAuthCallback(null)).toBeNull();
    expect(forwardableAuthCallback('')).toBeNull();
    expect(forwardableAuthCallback('//evil.com')).toBeNull();
    expect(forwardableAuthCallback('https://evil.com')).toBeNull();
    expect(forwardableAuthCallback('/en/register')).toBeNull();
    expect(forwardableAuthCallback('/dashboard')).toBeNull();
    expect(forwardableAuthCallback('/vi/dashboard')).toBeNull();
    expect(forwardableAuthCallback('/start')).toBeNull();
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
    expect(withAuthCallback('/register', '/dashboard')).toBe('/register');
  });
});
