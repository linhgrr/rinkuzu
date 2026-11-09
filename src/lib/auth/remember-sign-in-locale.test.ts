import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn } }));

import { rememberSignInLocale } from '@/lib/auth/remember-sign-in-locale';

const ACCOUNT_ID = '507f191e810c19729de860ea';

function request(referer: string | null, cookieValues: Record<string, string> = {}) {
  mocks.headers.mockResolvedValue(new Headers(referer ? { referer } : {}));
  mocks.cookies.mockResolvedValue({
    get: (name: string) => (name in cookieValues ? { value: cookieValues[name] } : undefined),
  });
}

describe('rememberSignInLocale', () => {
  const repository = { rememberLocaleIfMissing: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.rememberLocaleIfMissing.mockResolvedValue(undefined);
  });

  it('stores the locale the sign-in form sent', async () => {
    request('https://www.rinkuzu.app/vi/login');
    await rememberSignInLocale(repository, ACCOUNT_ID, 'en');
    expect(repository.rememberLocaleIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, 'en');
  });

  it('reads a Google sign-in locale from the Auth.js callback cookie', async () => {
    request('https://accounts.google.com/', {
      '__Secure-authjs.callback-url': 'https://www.rinkuzu.app/en/start',
    });
    await rememberSignInLocale(repository, ACCOUNT_ID);
    expect(repository.rememberLocaleIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, 'en');
  });

  it('writes nothing when the request names no locale', async () => {
    request(null);
    await rememberSignInLocale(repository, ACCOUNT_ID, 'fr');
    expect(repository.rememberLocaleIfMissing).not.toHaveBeenCalled();
  });

  it('still uses the sent locale outside a request scope', async () => {
    mocks.cookies.mockRejectedValue(new Error('outside a request scope'));
    mocks.headers.mockRejectedValue(new Error('outside a request scope'));
    await rememberSignInLocale(repository, ACCOUNT_ID, 'vi');
    expect(repository.rememberLocaleIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, 'vi');
  });

  it('logs and swallows a write failure so the sign-in goes on', async () => {
    request('https://www.rinkuzu.app/en/login');
    repository.rememberLocaleIfMissing.mockRejectedValue(new Error('db down'));
    await expect(rememberSignInLocale(repository, ACCOUNT_ID)).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
