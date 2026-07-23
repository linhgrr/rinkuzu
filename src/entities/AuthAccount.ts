export type AuthAuditEvent =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'account_locked'
  | 'logout'
  | 'register'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verified'
  | 'email_verification_sent';

export interface AuthAccountIdentity {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface AuthAccountSecurityState extends AuthAccountIdentity {
  passwordHash?: string;
  authProviders: string[];
  emailVerified?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
}

export interface AuthLoginAccount extends AuthAccountIdentity {
  passwordHash?: string;
  emailVerified?: Date;
  avatar?: string;
  displayName?: string;
  passwordChangedAt?: Date;
  /** Session revocation counter; copied into JWT as `av`. */
  authVersion: number;
  failedLoginAttempts: number;
  failedLoginWindowStart?: Date;
  lockedUntil?: Date;
}

export interface AuthenticatedUser extends AuthAccountIdentity {
  avatar?: string;
  displayName?: string;
  passwordChangedAt: number | null;
  /** Exact match required against JWT `av` during session hydration. */
  authVersion: number;
}

export interface FailedLoginAttemptState {
  attempts: number;
  lockedUntil?: Date;
}

export interface AuthRequestContext {
  ip: string | null;
  userAgent: string | null;
}
