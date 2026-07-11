export type LoginActionErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'account_locked'
  | 'rate_limit_exceeded'
  | 'login_failed';

export type LoginActionState =
  | { status: 'idle' }
  | {
      status: 'error';
      code: LoginActionErrorCode;
      retryAfterSeconds?: number;
    };

export const INITIAL_LOGIN_ACTION_STATE: LoginActionState = { status: 'idle' };
