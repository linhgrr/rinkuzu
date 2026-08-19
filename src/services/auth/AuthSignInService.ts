import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import type {
  AuthenticatedUser,
  AuthLoginAccount,
  AuthRequestContext,
} from '@/entities/AuthAccount';
import type {
  FailedLoginPolicy,
  IAuthSignInRepository,
} from '@/interfaces/repositories/IAuthAccountRepository';
import type { IAuthAudit } from '@/interfaces/services/IAuthAudit';
import type { IAuthRateLimiter } from '@/interfaces/services/IAuthRateLimiter';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import { hashPassword, verifyPassword } from '@/lib/password';
import { canonicalizeEmail } from '@/shared/email/canonical-email';

export type AuthSignInPolicy = FailedLoginPolicy;

export interface CredentialsSignInInput {
  email: string;
  password: string;
}

export interface GoogleSignInInput {
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  avatar?: string;
}

export type CredentialsSignInFailure =
  | { success: false; code: 'invalid_credentials' }
  | { success: false; code: 'email_not_verified' }
  | { success: false; code: 'account_locked'; retryAfterSeconds: number }
  | { success: false; code: 'rate_limit_exceeded'; retryAfterSeconds: number };

export type CredentialsSignInResult =
  | { success: true; user: AuthenticatedUser }
  | CredentialsSignInFailure;

export type GoogleSignInResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; code: 'invalid_google_profile' };

type CredentialsRateLimitFailure = Extract<
  CredentialsSignInFailure,
  { code: 'rate_limit_exceeded' }
>;

let dummyHashPromise: Promise<string> | undefined;

function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(`__rinkuzu_auth_decoy_${randomUUID()}__`);
  return dummyHashPromise;
}

function identityRateLimitKey(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

function remainingLockSeconds(account: AuthLoginAccount, now: Date): number {
  if (!account.lockedUntil) return 0;
  return Math.max(0, Math.ceil((account.lockedUntil.getTime() - now.getTime()) / 1000));
}

export class AuthSignInService {
  constructor(
    private readonly repository: IAuthSignInRepository,
    private readonly rateLimiter: IAuthRateLimiter,
    private readonly audit: IAuthAudit,
    private readonly scheduler: IDeferredTaskScheduler,
    private readonly policy: AuthSignInPolicy,
  ) {}

  async authenticateCredentials(
    input: CredentialsSignInInput,
    context: AuthRequestContext,
  ): Promise<CredentialsSignInResult> {
    const email = canonicalizeEmail(input.email);
    const limited = await this.checkCredentialsRateLimits(email, context.ip);
    if (limited) return limited;

    const account = await this.repository.findLoginAccount(email);
    const passwordHash = account?.passwordHash ?? (await getDummyPasswordHash());
    const verification = await verifyPassword(input.password, passwordHash);
    const now = new Date();

    if (!account?.passwordHash || !verification.valid) {
      let attempts: number | undefined;
      let lockedUntil: Date | undefined;
      const alreadyLocked = account ? remainingLockSeconds(account, now) > 0 : false;

      if (account?.passwordHash && !alreadyLocked) {
        const state = await this.repository.recordFailedLogin(account.id, now, this.policy);
        attempts = state?.attempts;
        lockedUntil = state?.lockedUntil;
      }

      this.scheduleAudit(lockedUntil ? 'account_locked' : 'login_failed', context, {
        ...(account ? { userId: account.id, email: account.email } : { email }),
        metadata: {
          ...(!account?.passwordHash ? { reason: 'unknown_user_or_passwordless' } : {}),
          ...(attempts !== undefined ? { attempts } : {}),
        },
      });
      return { success: false, code: 'invalid_credentials' };
    }

    const retryAfterSeconds = remainingLockSeconds(account, now);
    if (retryAfterSeconds > 0) {
      this.scheduleAudit('login_locked', context, {
        userId: account.id,
        email: account.email,
      });
      return { success: false, code: 'account_locked', retryAfterSeconds };
    }

    if (!account.emailVerified) {
      this.scheduleAudit('login_failed', context, {
        userId: account.id,
        email: account.email,
        metadata: { reason: 'email_not_verified' },
      });
      return { success: false, code: 'email_not_verified' };
    }

    const replacementPasswordHash = verification.needsRehash
      ? await hashPassword(input.password)
      : undefined;
    const authenticatedUser = await this.repository.recordSuccessfulLogin(
      account.id,
      account.passwordHash,
      {
        now,
        ip: context.ip,
        expectedAuthVersion: account.authVersion,
        ...(replacementPasswordHash ? { passwordHash: replacementPasswordHash } : {}),
      },
    );
    if (!authenticatedUser) {
      this.scheduleAudit('login_failed', context, {
        userId: account.id,
        email: account.email,
        metadata: { reason: 'account_changed_during_login' },
      });
      return { success: false, code: 'invalid_credentials' };
    }

    this.scheduleAudit('login_success', context, {
      userId: account.id,
      email: account.email,
      metadata: { provider: 'credentials' },
    });
    return { success: true, user: authenticatedUser };
  }

  async authenticateGoogle(
    input: GoogleSignInInput,
    context: AuthRequestContext,
  ): Promise<GoogleSignInResult> {
    const email = input.email ? canonicalizeEmail(input.email) : '';
    const subject = input.subject.trim();
    if (!email || !subject || !input.emailVerified) {
      return { success: false, code: 'invalid_google_profile' };
    }

    const user = await this.repository.resolveVerifiedGoogleAccount({
      subject,
      email,
      now: new Date(),
      ip: context.ip,
      ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
      ...(input.avatar ? { avatar: input.avatar.trim() } : {}),
    });
    // Disabled / unusable Google accounts reject generically (no existence leak).
    if (!user) {
      return { success: false, code: 'invalid_google_profile' };
    }
    this.scheduleAudit('login_success', context, {
      userId: user.id,
      email: user.email,
      metadata: { provider: 'google' },
    });
    return { success: true, user };
  }

  private async checkCredentialsRateLimits(
    email: string,
    ip: string | null,
  ): Promise<CredentialsRateLimitFailure | null> {
    const decisions = await Promise.all([
      this.rateLimiter.consume('credentials_ip', ip?.trim() || 'unknown'),
      this.rateLimiter.consume('credentials_identity', identityRateLimitKey(email)),
    ]);
    const blocked = decisions.filter(
      (decision): decision is Extract<typeof decision, { allowed: false }> => !decision.allowed,
    );
    if (blocked.length === 0) return null;
    return {
      success: false,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: Math.max(...blocked.map((decision) => decision.retryAfterSeconds)),
    };
  }

  private scheduleAudit(
    event: Parameters<IAuthAudit['record']>[0]['event'],
    context: AuthRequestContext,
    identity: Omit<Parameters<IAuthAudit['record']>[0], keyof AuthRequestContext | 'event'>,
  ): void {
    this.scheduler.schedule(() => this.audit.record({ event, ...identity, ...context }));
  }
}
