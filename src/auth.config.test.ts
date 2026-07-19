import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import authConfig, { resolveAuthRedirectTarget } from '@/auth.config';

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

describe('edge-safe auth callbacks', () => {
  it('delegates redirects to the locale-safe resolver', () => {
    expect(
      authConfig.callbacks.redirect({
        url: '/en/profile',
        baseUrl: 'https://www.rinkuzu.app',
      }),
    ).toBe('https://www.rinkuzu.app/en/profile');
  });

  it('projects JWT claims into the session', () => {
    const projectSession = authConfig.callbacks.session as (input: {
      session: Session;
      token: JWT;
    }) => Session;
    const session = {
      expires: '2099-01-01T00:00:00.000Z',
      user: {
        id: '507f191e810c19729de860ea',
        name: null,
        email: 'old@example.com',
        image: null,
        role: 'user' as const,
      },
    };

    expect(
      projectSession({
        session,
        token: {
          id: '507f191e810c19729de860ea',
          sub: '507f191e810c19729de860ea',
          email: 'user@example.com',
          role: 'user',
          av: 2,
        },
      }),
    ).toMatchObject({
      user: {
        id: '507f191e810c19729de860ea',
        email: 'old@example.com',
        role: 'user',
      },
    });
  });
});
