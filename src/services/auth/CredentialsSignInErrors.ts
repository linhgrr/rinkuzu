import { CredentialsSignin } from 'next-auth';

import type { CredentialsSignInFailure } from '@/services/auth/AuthSignInService';

class InvalidCredentialsError extends CredentialsSignin {
  override code = 'invalid_credentials';
}

class EmailNotVerifiedError extends CredentialsSignin {
  override code = 'email_not_verified';
}

class AccountLockedError extends CredentialsSignin {
  override code = 'account_locked';

  constructor(readonly retryAfterSeconds: number) {
    super();
  }
}

class CredentialsRateLimitError extends CredentialsSignin {
  override code = 'rate_limit_exceeded';

  constructor(readonly retryAfterSeconds: number) {
    super();
  }
}

export function toCredentialsSignInError(failure: CredentialsSignInFailure): CredentialsSignin {
  switch (failure.code) {
    case 'invalid_credentials':
      return new InvalidCredentialsError();
    case 'email_not_verified':
      return new EmailNotVerifiedError();
    case 'account_locked':
      return new AccountLockedError(failure.retryAfterSeconds);
    case 'rate_limit_exceeded':
      return new CredentialsRateLimitError(failure.retryAfterSeconds);
  }
}
