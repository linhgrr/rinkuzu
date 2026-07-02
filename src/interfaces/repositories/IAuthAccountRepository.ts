import type { AuthAccountIdentity, AuthAccountSecurityState } from '@/entities/AuthAccount';

export interface CreatePendingAccountData {
  email: string;
  passwordHash: string;
  displayName?: string;
  verificationTokenHash: string;
  verificationExpires: Date;
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
