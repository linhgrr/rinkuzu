import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { describe, expect, it } from 'vitest';
import { routing } from './routing';

const intl = createMiddleware(routing);
const go = (path: string, headers: Record<string, string> = {}) =>
  intl(new NextRequest(`https://www.rinkuzu.app${path}`, { headers }));

describe('locale routing without a locale cookie (RIN-1679)', () => {
  it.each([
    ['en-US,en;q=0.9', '/en'],
    ['vi-VN,vi;q=0.9', '/vi'],
    ['', '/vi'],
  ])('sends bare / with Accept-Language %j to %s', (acceptLanguage, target) => {
    const response = go('/', acceptLanguage ? { 'accept-language': acceptLanguage } : {});
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe(target);
  });

  it('sets no cookie on a localized page or on the redirect', () => {
    expect(go('/vi/about').headers.get('set-cookie')).toBeNull();
    expect(go('/', { 'accept-language': 'en' }).headers.get('set-cookie')).toBeNull();
  });
});
