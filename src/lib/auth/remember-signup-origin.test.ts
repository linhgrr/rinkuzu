import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn } }));

import { rememberGoogleSignupOrigin } from '@/lib/auth/remember-signup-origin';

const ACCOUNT_ID = '507f191e810c19729de860ea';

function request(headerValues: Record<string, string>, cookieValues: Record<string, string> = {}) {
  mocks.headers.mockResolvedValue(new Headers(headerValues));
  mocks.cookies.mockResolvedValue({
    get: (name: string) => (name in cookieValues ? { value: cookieValues[name] } : undefined),
  });
}

describe('rememberGoogleSignupOrigin', () => {
  const repository = { recordSignupOriginIfMissing: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.recordSignupOriginIfMissing.mockResolvedValue(undefined);
  });

  it('stores the NEXT_LOCALE cookie and the edge country', async () => {
    request({ 'x-vercel-ip-country': 'SG' }, { NEXT_LOCALE: 'en' });
    await rememberGoogleSignupOrigin(repository, ACCOUNT_ID);
    expect(repository.recordSignupOriginIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, {
      signupLocale: 'en',
      signupCountry: 'SG',
    });
  });

  it('prefers the Auth.js callback-url page locale', async () => {
    request(
      { referer: 'https://accounts.google.com/', 'x-vercel-ip-country': 'VN' },
      { 'authjs.callback-url': 'https://www.rinkuzu.app/en/start', NEXT_LOCALE: 'vi' },
    );
    await rememberGoogleSignupOrigin(repository, ACCOUNT_ID);
    expect(repository.recordSignupOriginIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, {
      signupLocale: 'en',
      signupCountry: 'VN',
    });
  });

  it('falls back to vi and a null country when the request says neither', async () => {
    request({});
    await rememberGoogleSignupOrigin(repository, ACCOUNT_ID);
    expect(repository.recordSignupOriginIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, {
      signupLocale: 'vi',
      signupCountry: null,
    });
  });

  it('stores no country for the Tor pseudo-country', async () => {
    request({ 'x-vercel-ip-country': 'T1' }, { NEXT_LOCALE: 'vi' });
    await rememberGoogleSignupOrigin(repository, ACCOUNT_ID);
    expect(repository.recordSignupOriginIfMissing).toHaveBeenCalledWith(ACCOUNT_ID, {
      signupLocale: 'vi',
      signupCountry: null,
    });
  });

  it('logs and swallows a failure so the sign-in goes on', async () => {
    mocks.headers.mockRejectedValue(new Error('outside a request scope'));
    mocks.cookies.mockRejectedValue(new Error('outside a request scope'));
    await expect(rememberGoogleSignupOrigin(repository, ACCOUNT_ID)).resolves.toBeUndefined();
    expect(repository.recordSignupOriginIfMissing).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });
});
