import type {
  AuthAccountIdentity,
  AuthAccountSecurityState,
  AuthenticatedUser,
  AuthLoginAccount,
  FailedLoginAttemptState,
} from '@/entities/AuthAccount';

export interface CreatePendingAccountData {
  email: string;
  passwordHash: string;
  displayName?: string;
  verificationTokenHash: string;
  verificationExpires: Date;
}

export interface FailedLoginPolicy {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

export interface SuccessfulLoginData {
  now: Date;
  ip: string | null;
  /** Exact authVersion loaded with the login account (CAS against disable/restore ABA). */
  expectedAuthVersion: number;
  passwordHash?: string;
}

export interface VerifiedGoogleAccountData {
  email: string;
  now: Date;
  ip: string | null;
  displayName?: string;
  avatar?: string;
}

export interface IAuthAccountRepository {
  /** Active accounts only. Disabled emails appear absent (generic outward behavior). */
  findByEmail(email: string): Promise<AuthAccountSecurityState | null>;

  createPending(data: CreatePendingAccountData): Promise<AuthAccountIdentity | null>;

  verifyEmail(tokenHash: string, now: Date): Promise<AuthAccountIdentity | null>;

  issuePasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean>;

  issueVerificationToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean>;

  findValidPasswordResetAccount(tokenHash: string, now: Date): Promise<AuthAccountIdentity | null>;

  resetPassword(
    accountId: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<AuthAccountIdentity | null>;
}

export interface IAuthSignInRepository {
  findLoginAccount(email: string): Promise<AuthLoginAccount | null>;

  findSessionUser(accountId: string): Promise<AuthenticatedUser | null>;

  recordFailedLogin(
    accountId: string,
    now: Date,
    policy: FailedLoginPolicy,
  ): Promise<FailedLoginAttemptState | null>;

  recordSuccessfulLogin(
    accountId: string,
    expectedPasswordHash: string,
    data: SuccessfulLoginData,
  ): Promise<boolean>;

  /**
   * Upserts only active accounts (`email` + `disable: 0`).
   * Returns null when the email belongs to a disabled account (duplicate-key) or is unusable.
   */
  upsertVerifiedGoogleAccount(data: VerifiedGoogleAccountData): Promise<AuthenticatedUser | null>;
}
