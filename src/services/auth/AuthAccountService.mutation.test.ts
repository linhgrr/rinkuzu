import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreatePendingAccountData,
  IAuthAccountRepository,
} from '@/interfaces/repositories/IAuthAccountRepository';
import type { AuthAccountIdentity, AuthAccountSecurityState } from '@/entities/AuthAccount';
import type { IAuthNotifier } from '@/interfaces/services/IAuthNotifier';
import type { IAuthAudit, AuthAuditRecord } from '@/interfaces/services/IAuthAudit';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import { AuthAccountService } from '@/services/auth/AuthAccountService';
import { createSecureToken, hashToken, wasIssuedRecently } from '@/lib/auth-tokens';
import { hashPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

vi.mock('@/lib/auth-tokens', () => ({
  createSecureToken: vi.fn(() => ({ raw: 'raw-token', hash: 'token-hash' })),
  hashToken: vi.fn((raw: string) => `hashed:${raw}`),
  wasIssuedRecently: vi.fn(),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-password:${password}`),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

const VERIFICATION_TTL_MS = 24 * 60 * 60_000;
const RESET_TOKEN_TTL_MS = 30 * 60_000;

const context = { ip: '10.0.0.1', userAgent: 'mutation-agent' };
const identity: AuthAccountIdentity = {
  id: '507f191e810c19729de860ea',
  email: 'user@example.com',
  role: 'user',
};

/**
 * Build security state for tests. Own-property-aware merge: keys present in
 * `overrides` with value `undefined` clear that optional (delete the key) so
 * defaults like passwordHash are not restored by truthiness checks.
 */
function securityState(
  overrides: {
    [K in keyof AuthAccountSecurityState]?: AuthAccountSecurityState[K] | undefined;
  } = {},
): AuthAccountSecurityState {
  const state: AuthAccountSecurityState = {
    ...identity,
    passwordHash: 'password-hash',
    authProviders: [],
  };

  for (const key of Object.keys(overrides) as Array<keyof AuthAccountSecurityState>) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) {
      continue;
    }
    const value = overrides[key];
    if (value === undefined) {
      delete state[key];
    } else {
      // Required keys are only reassigned when provided as defined values.
      Object.assign(state, { [key]: value });
    }
  }

  return state;
}

class AuthAccountRepositoryStub implements IAuthAccountRepository {
  findByEmail = vi.fn<(email: string) => Promise<AuthAccountSecurityState | null>>();
  createPending = vi.fn<(data: CreatePendingAccountData) => Promise<AuthAccountIdentity | null>>();
  verifyEmail = vi.fn<(tokenHash: string, now: Date) => Promise<AuthAccountIdentity | null>>();
  issuePasswordResetToken =
    vi.fn<(email: string, tokenHash: string, expiresAt: Date) => Promise<boolean>>();
  issueVerificationToken =
    vi.fn<(email: string, tokenHash: string, expiresAt: Date) => Promise<boolean>>();
  findValidPasswordResetAccount =
    vi.fn<(tokenHash: string, now: Date) => Promise<AuthAccountIdentity | null>>();
  resetPassword =
    vi.fn<
      (
        accountId: string,
        tokenHash: string,
        passwordHash: string,
        now: Date,
      ) => Promise<AuthAccountIdentity | null>
    >();
}

class AuthNotifierStub implements IAuthNotifier {
  sendVerificationEmail = vi.fn<(email: string, rawToken: string) => Promise<void>>();
  sendPasswordResetEmail = vi.fn<(email: string, rawToken: string) => Promise<void>>();
  sendPasswordChangedEmail = vi.fn<(email: string) => Promise<void>>();
}

class AuthAuditStub implements IAuthAudit {
  record = vi.fn<(input: AuthAuditRecord) => Promise<void>>();
}

class DeferredTaskSchedulerStub implements IDeferredTaskScheduler {
  readonly tasks: Array<() => Promise<void>> = [];

  schedule = vi.fn((task: () => Promise<void>) => {
    this.tasks.push(task);
  });

  async runAll(): Promise<void> {
    const pending = [...this.tasks];
    this.tasks.length = 0;
    await Promise.all(pending.map((task) => task()));
  }
}

describe('AuthAccountService mutation coverage', () => {
  let repository: AuthAccountRepositoryStub;
  let notifier: AuthNotifierStub;
  let audit: AuthAuditStub;
  let scheduler: DeferredTaskSchedulerStub;
  let service: AuthAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AuthAccountRepositoryStub();
    notifier = new AuthNotifierStub();
    audit = new AuthAuditStub();
    scheduler = new DeferredTaskSchedulerStub();
    service = new AuthAccountService(repository, notifier, audit, scheduler, {
      claim: vi.fn(async () => []),
      claimHashed: vi.fn(async () => []),
    });
    notifier.sendVerificationEmail.mockResolvedValue();
    notifier.sendPasswordResetEmail.mockResolvedValue();
    notifier.sendPasswordChangedEmail.mockResolvedValue();
    audit.record.mockResolvedValue();
    vi.mocked(wasIssuedRecently).mockReturnValue(false);
    vi.mocked(createSecureToken).mockReturnValue({ raw: 'raw-token', hash: 'token-hash' });
    vi.mocked(hashToken).mockImplementation((raw: string) => `hashed:${raw}`);
    vi.mocked(hashPassword).mockImplementation(
      async (password: string) => `hashed-password:${password}`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('treats a createPending race as a neutral duplicate registration', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.createPending.mockResolvedValue(null);

      await expect(
        service.register({ email: identity.email, password: 'password12' }, context),
      ).resolves.toEqual({
        success: true,
        data: { email: identity.email },
      });
      expect(scheduler.schedule).toHaveBeenCalledTimes(1);
      expect(notifier.sendVerificationEmail).not.toHaveBeenCalled();

      await scheduler.runAll();
      expect(audit.record).toHaveBeenCalledWith({
        event: 'register',
        email: identity.email,
        metadata: { reason: 'duplicate_email' },
        ...context,
      });
      expect(audit.record).toHaveBeenCalledTimes(1);
    });

    it('issues a verification token that expires exactly one day from now and audits both events', async () => {
      const now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      repository.findByEmail.mockResolvedValue(null);
      repository.createPending.mockResolvedValue(identity);

      await expect(
        service.register({ email: identity.email, password: 'password12' }, context),
      ).resolves.toEqual({
        success: true,
        data: { email: identity.email },
      });

      expect(repository.createPending).toHaveBeenCalledWith({
        email: identity.email,
        passwordHash: 'hashed-password:password12',
        signupOrigin: { signupLocale: 'vi', signupCountry: null },
        verificationTokenHash: 'token-hash',
        verificationExpires: new Date(now + VERIFICATION_TTL_MS),
      });
      expect(now + VERIFICATION_TTL_MS).toBe(now + 86_400_000);

      await scheduler.runAll();
      expect(notifier.sendVerificationEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
      expect(audit.record).toHaveBeenCalledWith({
        event: 'register',
        userId: identity.id,
        email: identity.email,
        ...context,
      });
      expect(audit.record).toHaveBeenCalledWith({
        event: 'email_verification_sent',
        userId: identity.id,
        email: identity.email,
        ...context,
      });
      expect(audit.record).toHaveBeenCalledTimes(2);
    });

    it('returns a 500 when registration throws', async () => {
      repository.findByEmail.mockRejectedValue(new Error('db down'));

      await expect(
        service.register({ email: identity.email, password: 'password12' }, context),
      ).resolves.toEqual({
        success: false,
        error: 'Internal server error',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Registration error');
    });
  });

  describe('verifyEmail', () => {
    it('returns a 500 when verification throws', async () => {
      repository.verifyEmail.mockRejectedValue(new Error('verify boom'));

      await expect(service.verifyEmail('token', context)).resolves.toEqual({
        success: false,
        error: 'Failed to verify email',
        statusCode: 500,
      });
      expect(hashToken).toHaveBeenCalledWith('token');
      expect(logger.error).toHaveBeenCalledWith({ error: expect.any(Error) }, 'Verify-email error');
    });
  });

  describe('requestPasswordReset', () => {
    it('lets an oauth account establish credentials through an emailed reset token', async () => {
      repository.findByEmail.mockResolvedValue(securityState({ passwordHash: undefined }));
      repository.issuePasswordResetToken.mockResolvedValue(true);

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issuePasswordResetToken).toHaveBeenCalledWith(
        identity.email,
        'token-hash',
        expect.any(Date),
      );

      await scheduler.runAll();
      expect(notifier.sendPasswordResetEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
      expect(audit.record).toHaveBeenCalledWith({
        event: 'password_reset_requested',
        userId: identity.id,
        email: identity.email,
        ...context,
      });
    });

    it('skips rotation only when a reset token hash exists and was issued recently', async () => {
      repository.findByEmail.mockResolvedValue(
        securityState({
          passwordResetTokenHash: 'existing-hash',
          passwordResetExpires: new Date(Date.now() + 10_000),
        }),
      );
      vi.mocked(wasIssuedRecently).mockReturnValue(true);

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(wasIssuedRecently).toHaveBeenCalledWith(expect.any(Date), RESET_TOKEN_TTL_MS, 60_000);
      expect(createSecureToken).not.toHaveBeenCalled();
      expect(repository.issuePasswordResetToken).not.toHaveBeenCalled();
      expect(scheduler.schedule).not.toHaveBeenCalled();
    });

    it('still issues a reset token when a prior hash exists but was not recent', async () => {
      const now = 1_700_000_100_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      repository.findByEmail.mockResolvedValue(
        securityState({
          passwordResetTokenHash: 'stale-hash',
          passwordResetExpires: new Date(now - 1),
        }),
      );
      vi.mocked(wasIssuedRecently).mockReturnValue(false);
      repository.issuePasswordResetToken.mockResolvedValue(true);

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issuePasswordResetToken).toHaveBeenCalledWith(
        identity.email,
        'token-hash',
        new Date(now + RESET_TOKEN_TTL_MS),
      );
      expect(now + RESET_TOKEN_TTL_MS).toBe(now + 1_800_000);

      await scheduler.runAll();
      expect(notifier.sendPasswordResetEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
      expect(audit.record).toHaveBeenCalledWith({
        event: 'password_reset_requested',
        userId: identity.id,
        email: identity.email,
        ...context,
      });
    });

    it('issues a token when no prior reset hash exists even if wasIssuedRecently is true', async () => {
      repository.findByEmail.mockResolvedValue(
        securityState({
          passwordResetTokenHash: undefined,
          passwordResetExpires: undefined,
        }),
      );
      vi.mocked(wasIssuedRecently).mockReturnValue(true);
      repository.issuePasswordResetToken.mockResolvedValue(true);

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issuePasswordResetToken).toHaveBeenCalled();
    });

    it('does not notify when the repository declines to issue a reset token', async () => {
      repository.findByEmail.mockResolvedValue(securityState());
      repository.issuePasswordResetToken.mockResolvedValue(false);

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(scheduler.schedule).not.toHaveBeenCalled();
      expect(notifier.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('stays neutral when forgot-password throws', async () => {
      repository.findByEmail.mockRejectedValue(new Error('network'));

      await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Forgot-password error',
      );
    });
  });

  describe('resendVerification', () => {
    it('audits unknown users without issuing a token', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issueVerificationToken).not.toHaveBeenCalled();

      await scheduler.runAll();
      expect(audit.record).toHaveBeenCalledWith({
        event: 'email_verification_sent',
        email: identity.email,
        metadata: { reason: 'unknown_user' },
        ...context,
      });
    });

    it('audits already-verified accounts without issuing a token', async () => {
      repository.findByEmail.mockResolvedValue(
        securityState({ emailVerified: new Date('2026-01-01T00:00:00.000Z') }),
      );

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issueVerificationToken).not.toHaveBeenCalled();

      await scheduler.runAll();
      expect(audit.record).toHaveBeenCalledWith({
        event: 'email_verification_sent',
        email: identity.email,
        metadata: { reason: 'already_verified_or_oauth' },
        ...context,
      });
    });

    it('audits oauth accounts without a password hash without issuing a token', async () => {
      repository.findByEmail.mockResolvedValue(
        securityState({ passwordHash: undefined, emailVerified: undefined }),
      );

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issueVerificationToken).not.toHaveBeenCalled();

      await scheduler.runAll();
      expect(audit.record).toHaveBeenCalledWith({
        event: 'email_verification_sent',
        email: identity.email,
        metadata: { reason: 'already_verified_or_oauth' },
        ...context,
      });
    });

    it('skips rotation only when a verification hash exists and was issued recently', async () => {
      repository.findByEmail.mockResolvedValue(
        securityState({
          emailVerified: undefined,
          emailVerificationTokenHash: 'existing',
          emailVerificationExpires: new Date(Date.now() + 60_000),
        }),
      );
      vi.mocked(wasIssuedRecently).mockReturnValue(true);

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(wasIssuedRecently).toHaveBeenCalledWith(expect.any(Date), VERIFICATION_TTL_MS, 60_000);
      expect(createSecureToken).not.toHaveBeenCalled();
      expect(repository.issueVerificationToken).not.toHaveBeenCalled();
    });

    it('issues a verification token when a prior hash exists but was not recent', async () => {
      const now = 1_700_000_200_000;
      vi.spyOn(Date, 'now').mockReturnValue(now);
      repository.findByEmail.mockResolvedValue(
        securityState({
          emailVerified: undefined,
          emailVerificationTokenHash: 'stale',
          emailVerificationExpires: new Date(now - 1),
        }),
      );
      vi.mocked(wasIssuedRecently).mockReturnValue(false);
      repository.issueVerificationToken.mockResolvedValue(true);

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(repository.issueVerificationToken).toHaveBeenCalledWith(
        identity.email,
        'token-hash',
        new Date(now + VERIFICATION_TTL_MS),
      );

      await scheduler.runAll();
      expect(notifier.sendVerificationEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
      expect(audit.record).toHaveBeenCalledWith({
        event: 'email_verification_sent',
        userId: identity.id,
        email: identity.email,
        ...context,
      });
    });

    it('does not notify when the repository declines to issue a verification token', async () => {
      repository.findByEmail.mockResolvedValue(securityState({ emailVerified: undefined }));
      repository.issueVerificationToken.mockResolvedValue(false);

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(scheduler.schedule).not.toHaveBeenCalled();
      expect(notifier.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('stays neutral when resend-verification throws', async () => {
      repository.findByEmail.mockRejectedValue(new Error('resend boom'));

      await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
        success: true,
        data: { email: identity.email, requested: true },
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Resend-verification error',
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects when the atomic reset loses the race', async () => {
      repository.findValidPasswordResetAccount.mockResolvedValue(identity);
      repository.resetPassword.mockResolvedValue(null);

      await expect(service.resetPassword('raw-reset', 'new-password', context)).resolves.toEqual({
        success: false,
        error: 'Reset link is invalid or has expired',
        statusCode: 400,
      });
      expect(hashPassword).toHaveBeenCalledWith('new-password');
      expect(scheduler.schedule).not.toHaveBeenCalled();
      expect(notifier.sendPasswordChangedEmail).not.toHaveBeenCalled();
    });

    it('returns a 500 when reset-password throws', async () => {
      repository.findValidPasswordResetAccount.mockRejectedValue(new Error('reset boom'));

      await expect(service.resetPassword('raw-reset', 'new-password', context)).resolves.toEqual({
        success: false,
        error: 'Failed to reset password',
        statusCode: 500,
      });
      expect(logger.error).toHaveBeenCalledWith(
        { error: expect.any(Error) },
        'Reset-password error',
      );
    });
  });
});
