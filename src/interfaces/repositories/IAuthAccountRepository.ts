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

  upsertVerifiedGoogleAccount(data: VerifiedGoogleAccountData): Promise<AuthenticatedUser>;
}
