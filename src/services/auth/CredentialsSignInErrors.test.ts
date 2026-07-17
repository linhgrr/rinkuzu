import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = 'credentials';
  },
}));

import { CredentialsSignin } from 'next-auth';
import { toCredentialsSignInError } from '@/services/auth/CredentialsSignInErrors';

describe('CredentialsSignInErrors', () => {
  it('maps public result codes to Auth.js CredentialsSignin errors', () => {
    const invalid = toCredentialsSignInError({ success: false, code: 'invalid_credentials' });
    expect(invalid).toBeInstanceOf(CredentialsSignin);
    expect(invalid.code).toBe('invalid_credentials');

    const unverified = toCredentialsSignInError({ success: false, code: 'email_not_verified' });
    expect(unverified).toBeInstanceOf(CredentialsSignin);
    expect(unverified.code).toBe('email_not_verified');

    const locked = toCredentialsSignInError({
      success: false,
      code: 'account_locked',
      retryAfterSeconds: 120,
    });
    expect(locked).toBeInstanceOf(CredentialsSignin);
    expect(locked.code).toBe('account_locked');
    expect((locked as { retryAfterSeconds?: number }).retryAfterSeconds).toBe(120);

    const limited = toCredentialsSignInError({
      success: false,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: 60,
    });
    expect(limited).toBeInstanceOf(CredentialsSignin);
    expect(limited.code).toBe('rate_limit_exceeded');
    expect((limited as { retryAfterSeconds?: number }).retryAfterSeconds).toBe(60);
  });
});
