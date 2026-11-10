import type {
  AuthAccountIdentity,
  AuthAccountSecurityState,
  AuthenticatedUser,
  AuthLoginAccount,
  FailedLoginAttemptState,
} from '@/entities/AuthAccount';
import type { Locale } from '@/i18n/config';

/** Analytics-only origin of a new account (RIN-1268); set once, at creation. */
export interface SignupOrigin {
  signupLocale: Locale;
  /** ISO-3166 alpha-2 from the edge; null when unknown. */
  signupCountry: string | null;
}

export interface CreatePendingAccountData {
  email: string;
  passwordHash: string;
  displayName?: string;
  /** UI locale the signup came from; omitted when the request did not say. */
  locale?: Locale;
  signupOrigin: SignupOrigin;
  verificationTokenHash: string;
  verificationExpires: Date;
  /** SHA-256 hashes of the guest claim tokens the browser held at sign-up (RIN-1310). */
  guestClaimHashes?: string[];
  /** SHA-256 hashes of the guest draft tokens the browser held at sign-up (RIN-1447). */
  guestDraftHashes?: string[];
}

export interface VerifiedEmailAccount extends AuthAccountIdentity {
  /** Guest claim token hashes stored at sign-up, removed by this verification. */
  guestClaimHashes?: string[];
  /** Guest draft token hashes stored at sign-up, removed by this verification. */
  guestDraftHashes?: string[];
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
  subject: string;
  email: string;
  now: Date;
  ip: string | null;
  displayName?: string;
  avatar?: string;
}

export interface ResolvedGoogleAccount extends AuthenticatedUser {
  /** True only when this sign-in inserted the user document (first-ever Rinkuzu account). */
  isNewAccount: boolean;
}

export interface IAuthAccountRepository {
  /** Active accounts only. Disabled emails appear absent (generic outward behavior). */
  findByEmail(email: string): Promise<AuthAccountSecurityState | null>;

  createPending(data: CreatePendingAccountData): Promise<AuthAccountIdentity | null>;

  verifyEmail(tokenHash: string, now: Date): Promise<VerifiedEmailAccount | null>;

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
  ): Promise<AuthenticatedUser | null>;

  /**
   * Upserts only active accounts (`email` + `disable: 0`).
   * Returns null when the email belongs to a disabled account (duplicate-key) or is unusable.
   */
  resolveVerifiedGoogleAccount(
    data: VerifiedGoogleAccountData,
  ): Promise<ResolvedGoogleAccount | null>;
}

/** Records an account's UI locale once; a stored locale is never overwritten (RIN-1263). */
export interface IAccountLocaleRepository {
  rememberLocaleIfMissing(accountId: string, locale: Locale): Promise<void>;
}

/** Records a new account's signup origin once; never overwrites one (RIN-1268). */
export interface ISignupOriginRepository {
  recordSignupOriginIfMissing(accountId: string, origin: SignupOrigin): Promise<void>;
}
