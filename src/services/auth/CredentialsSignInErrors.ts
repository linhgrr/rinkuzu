import { CredentialsSignin } from 'next-auth';

import type { CredentialsSignInFailure } from '@/services/auth/AuthSignInService';

export class InvalidCredentialsError extends CredentialsSignin {
  override code = 'invalid_credentials';
}

export class EmailNotVerifiedError extends CredentialsSignin {
  override code = 'email_not_verified';
}

export class AccountLockedError extends CredentialsSignin {
  override code = 'account_locked';

  constructor(readonly retryAfterSeconds: number) {
    super();
  }
}

export class CredentialsRateLimitError extends CredentialsSignin {
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
