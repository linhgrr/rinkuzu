import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signInMock, signOutMock, AuthError, CredentialsSignin } = vi.hoisted(() => {
  class CredentialsSignin extends Error {
    code = 'credentials';
    constructor(message = 'CredentialsSignin') {
      super(message);
      this.name = 'CredentialsSignin';
    }
  }
  class AuthError extends Error {
    constructor(message = 'AuthError') {
      super(message);
      this.name = 'AuthError';
    }
  }
  return {
    signInMock: vi.fn(),
    signOutMock: vi.fn(),
    AuthError,
    CredentialsSignin,
  };
});

vi.mock('next-auth', () => ({
  AuthError,
  CredentialsSignin,
}));

vi.mock('@/auth', () => ({
  signIn: signInMock,
  signOut: signOutMock,
}));

import { authenticateCredentials, authenticateGoogle, logout } from '@/features/auth/actions';
import { INITIAL_LOGIN_ACTION_STATE } from '@/features/auth/types/auth-actions';

function credentialsForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values = {
    email: '  Student@Example.com ',
    password: 'secret-password',
    locale: 'en',
    redirectTo: '/en/profile?tab=security',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe('Auth.js server actions', () => {
  beforeEach(() => {
    signInMock.mockReset();
    signOutMock.mockReset();
  });

  it('normalizes credentials and delegates the safe redirect to Auth.js', async () => {
    const redirectError = new Error('NEXT_REDIRECT');
    signInMock.mockRejectedValueOnce(redirectError);

    await expect(
      authenticateCredentials(INITIAL_LOGIN_ACTION_STATE, credentialsForm()),
    ).rejects.toBe(redirectError);
    expect(signInMock).toHaveBeenCalledOnce();
    expect(signInMock).toHaveBeenCalledWith('credentials', {
      email: 'student@example.com',
      password: 'secret-password',
      redirectTo: '/en/profile?tab=security',
    });
  });

  it('replaces an unsafe credentials redirect with the localized dashboard', async () => {
    const redirectError = new Error('NEXT_REDIRECT');
    signInMock.mockRejectedValueOnce(redirectError);

    await expect(
      authenticateCredentials(
        INITIAL_LOGIN_ACTION_STATE,
        credentialsForm({ redirectTo: '/\\evil.example/path' }),
      ),
    ).rejects.toBe(redirectError);
    expect(signInMock).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({ redirectTo: '/en/dashboard' }),
    );
  });

  it('returns a machine-safe credentials error and server-provided retry delay', async () => {
    const error = new CredentialsSignin();
    error.code = 'account_locked';
    Object.assign(error, { retryAfterSeconds: 73.2 });
    signInMock.mockRejectedValueOnce(error);

    await expect(
      authenticateCredentials(INITIAL_LOGIN_ACTION_STATE, credentialsForm()),
    ).resolves.toEqual({
      status: 'error',
      code: 'account_locked',
      retryAfterSeconds: 74,
    });
  });

  it('does not expose unknown credential or Auth.js error details', async () => {
    const credentialError = new CredentialsSignin();
    credentialError.code = 'internal_database_detail';
    signInMock.mockRejectedValueOnce(credentialError);

    await expect(
      authenticateCredentials(INITIAL_LOGIN_ACTION_STATE, credentialsForm()),
    ).resolves.toEqual({ status: 'error', code: 'invalid_credentials' });

    signInMock.mockRejectedValueOnce(new AuthError('provider detail'));
    await expect(
      authenticateCredentials(INITIAL_LOGIN_ACTION_STATE, credentialsForm()),
    ).resolves.toEqual({ status: 'error', code: 'login_failed' });
  });

  it('rejects malformed credentials before invoking Auth.js', async () => {
    await expect(
      authenticateCredentials(
        INITIAL_LOGIN_ACTION_STATE,
        credentialsForm({ email: 'not-an-email', password: '' }),
      ),
    ).resolves.toEqual({ status: 'error', code: 'invalid_credentials' });
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('sanitizes Google redirect targets on the server', async () => {
    signInMock.mockResolvedValueOnce(undefined);
    const formData = credentialsForm({ redirectTo: 'https://evil.example/path' });

    await authenticateGoogle(formData);

    expect(signInMock).toHaveBeenCalledWith('google', { redirectTo: '/en/dashboard' });
  });

  it('signs out to the localized public home', async () => {
    signOutMock.mockResolvedValueOnce(undefined);
    const formData = new FormData();
    formData.set('locale', 'en');

    await logout(formData);

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/en' });
  });
});
