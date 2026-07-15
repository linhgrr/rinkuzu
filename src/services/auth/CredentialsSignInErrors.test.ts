import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = 'credentials';
  },
}));

import {
  AccountLockedError,
  CredentialsRateLimitError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  toCredentialsSignInError,
} from '@/services/auth/CredentialsSignInErrors';

describe('CredentialsSignInErrors', () => {
  it('maps public result codes to Auth.js CredentialsSignin errors', () => {
    expect(
      toCredentialsSignInError({ success: false, code: 'invalid_credentials' }),
    ).toBeInstanceOf(InvalidCredentialsError);
    expect(toCredentialsSignInError({ success: false, code: 'email_not_verified' })).toBeInstanceOf(
      EmailNotVerifiedError,
    );

    const locked = toCredentialsSignInError({
      success: false,
      code: 'account_locked',
      retryAfterSeconds: 120,
    });
    expect(locked).toBeInstanceOf(AccountLockedError);
    expect((locked as AccountLockedError).retryAfterSeconds).toBe(120);

    const limited = toCredentialsSignInError({
      success: false,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: 60,
    });
    expect(limited).toBeInstanceOf(CredentialsRateLimitError);
    expect((limited as CredentialsRateLimitError).retryAfterSeconds).toBe(60);
  });
});
