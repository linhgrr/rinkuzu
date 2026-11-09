import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreatePendingAccountData,
  IAuthAccountRepository,
  VerifiedEmailAccount,
} from '@/interfaces/repositories/IAuthAccountRepository';
import type { AuthAccountIdentity, AuthAccountSecurityState } from '@/entities/AuthAccount';
import type { IAuthNotifier } from '@/interfaces/services/IAuthNotifier';
import type { IAuthAudit, AuthAuditRecord } from '@/interfaces/services/IAuthAudit';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import type { IGuestAttemptClaimService } from '@/interfaces/services/IGuestAttemptClaimService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { AuthAccountService } from '@/services/auth/AuthAccountService';
import { createSecureToken, hashToken, wasIssuedRecently } from '@/lib/auth-tokens';
import { hashPassword } from '@/lib/password';

vi.mock('@/lib/auth-tokens', () => ({
  createSecureToken: vi.fn(() => ({ raw: 'raw-token', hash: 'token-hash' })),
  hashToken: vi.fn((raw: string) => `hashed:${raw}`),
  wasIssuedRecently: vi.fn(),
}));

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async (password: string) => `hashed-password:${password}`),
}));

const context = { ip: '127.0.0.1', userAgent: 'vitest' };
const identity: AuthAccountIdentity = {
  id: '507f191e810c19729de860ea',
  email: 'user@example.com',
  role: 'user',
};

function securityState(
  overrides: Partial<AuthAccountSecurityState> = {},
): AuthAccountSecurityState {
  return {
    ...identity,
    passwordHash: 'password-hash',
    authProviders: [],
    ...overrides,
  };
}

class AuthAccountRepositoryStub implements IAuthAccountRepository {
  findByEmail = vi.fn<(email: string) => Promise<AuthAccountSecurityState | null>>();
  createPending = vi.fn<(data: CreatePendingAccountData) => Promise<AuthAccountIdentity | null>>();
  verifyEmail = vi.fn<(tokenHash: string, now: Date) => Promise<VerifiedEmailAccount | null>>();
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

class GuestAttemptClaimStub implements IGuestAttemptClaimService {
  claim = vi.fn<(userId: string, tokens: readonly string[]) => Promise<string[]>>();
  claimHashed = vi.fn<(userId: string, hashes: readonly string[]) => Promise<string[]>>();
}

class DeferredTaskSchedulerStub implements IDeferredTaskScheduler {
  readonly tasks: Array<() => Promise<void>> = [];

  schedule = vi.fn((task: () => Promise<void>) => {
    this.tasks.push(task);
  });

  async runAll(): Promise<void> {
    await Promise.all(this.tasks.map((task) => task()));
  }
}

describe('AuthAccountService', () => {
  let repository: AuthAccountRepositoryStub;
  let notifier: AuthNotifierStub;
  let audit: AuthAuditStub;
  let scheduler: DeferredTaskSchedulerStub;
  let guestAttempts: GuestAttemptClaimStub;
  let service: AuthAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new AuthAccountRepositoryStub();
    notifier = new AuthNotifierStub();
    audit = new AuthAuditStub();
    scheduler = new DeferredTaskSchedulerStub();
    guestAttempts = new GuestAttemptClaimStub();
    guestAttempts.claimHashed.mockResolvedValue([]);
    service = new AuthAccountService(repository, notifier, audit, scheduler, guestAttempts);
    notifier.sendVerificationEmail.mockResolvedValue();
    notifier.sendPasswordResetEmail.mockResolvedValue();
    notifier.sendPasswordChangedEmail.mockResolvedValue();
    audit.record.mockResolvedValue();
    vi.mocked(wasIssuedRecently).mockReturnValue(false);
  });

  it('keeps duplicate registration responses neutral', async () => {
    repository.findByEmail.mockResolvedValue(securityState());

    await expect(
      service.register({ email: identity.email, password: 'password' }, context),
    ).resolves.toEqual({
      success: true,
      data: { email: identity.email },
    });
    expect(hashPassword).not.toHaveBeenCalled();

    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith({
      event: 'register',
      email: identity.email,
      metadata: { reason: 'duplicate_email' },
      ...context,
    });
  });

  it('rejects a local registration when the existing account uses another method', async () => {
    repository.findByEmail.mockResolvedValue(
      securityState({ passwordHash: undefined, authProviders: ['google'] }),
    );

    await expect(
      service.register({ email: identity.email, password: 'password' }, context),
    ).resolves.toEqual({
      success: false,
      code: 'registration_method_mismatch',
      error:
        'Registration method does not match the existing account. Use the original sign-in method.',
      statusCode: 409,
    });
    expect(hashPassword).not.toHaveBeenCalled();

    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith({
      event: 'register',
      email: identity.email,
      metadata: { reason: 'registration_method_mismatch' },
      ...context,
    });
  });

  it('rejects legacy verified passwordless accounts before provider identity backfill', async () => {
    repository.findByEmail.mockResolvedValue(
      securityState({
        passwordHash: undefined,
        authProviders: [],
        emailVerified: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    await expect(
      service.register({ email: identity.email, password: 'password' }, context),
    ).resolves.toMatchObject({
      success: false,
      code: 'registration_method_mismatch',
      statusCode: 409,
    });
  });

  it('creates a pending account and defers notification plus audits', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createPending.mockResolvedValue(identity);

    const result = await service.register(
      { email: identity.email, password: 'password', displayName: 'Rin' },
      context,
    );

    expect(result).toEqual({
      success: true,
      data: { email: identity.email },
    });
    expect(repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        email: identity.email,
        passwordHash: 'hashed-password:password',
        displayName: 'Rin',
        verificationTokenHash: 'token-hash',
      }),
    );

    await scheduler.runAll();
    expect(notifier.sendVerificationEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('forwards the sign-up callbackUrl to the verification email', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createPending.mockResolvedValue(identity);

    await service.register(
      { email: identity.email, password: 'password', callbackUrl: '/quiz/nhap-mon-ai' },
      context,
    );

    await scheduler.runAll();
    expect(notifier.sendVerificationEmail).toHaveBeenCalledWith(identity.email, 'raw-token', {
      callbackUrl: '/quiz/nhap-mon-ai',
    });
  });

  // RIN-1310: the guest result must survive a verification link opened in another browser.
  it('stores only the hashes of the guest claim tokens on the pending account', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createPending.mockResolvedValue(identity);
    const token = 'A'.repeat(43);

    await service.register(
      { email: identity.email, password: 'password', guestClaimTokens: [token, token] },
      context,
    );

    const data = repository.createPending.mock.calls[0]?.[0];
    expect(data?.guestClaimHashes).toEqual([hashGuestClaimToken(token)]);
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it('stores no guest claim field when the browser holds no guest result', async () => {
    repository.findByEmail.mockResolvedValue(null);
    repository.createPending.mockResolvedValue(identity);

    await service.register({ email: identity.email, password: 'password' }, context);

    expect(repository.createPending.mock.calls[0]?.[0]).not.toHaveProperty('guestClaimHashes');
  });

  it('claims the guest attempts stored at sign-up when the email is verified', async () => {
    repository.verifyEmail.mockResolvedValue({ ...identity, guestClaimHashes: ['hash-1'] });

    await expect(service.verifyEmail('valid', context)).resolves.toEqual({
      success: true,
      data: { email: identity.email },
    });
    expect(guestAttempts.claimHashed).toHaveBeenCalledWith(identity.id, ['hash-1']);
  });

  it('still verifies the email when the guest claim fails', async () => {
    repository.verifyEmail.mockResolvedValue({ ...identity, guestClaimHashes: ['hash-1'] });
    guestAttempts.claimHashed.mockRejectedValue(new Error('db down'));

    await expect(service.verifyEmail('valid', context)).resolves.toEqual({
      success: true,
      data: { email: identity.email },
    });
  });

  it('skips the guest claim when the account stored none', async () => {
    repository.verifyEmail.mockResolvedValue(identity);

    await service.verifyEmail('valid', context);

    expect(guestAttempts.claimHashed).not.toHaveBeenCalled();
  });

  it('verifies valid tokens atomically and rejects invalid tokens', async () => {
    repository.verifyEmail.mockResolvedValueOnce(null).mockResolvedValueOnce(identity);

    await expect(service.verifyEmail('invalid', context)).resolves.toEqual({
      success: false,
      error: 'Verification link is invalid or has expired',
      statusCode: 400,
    });
    await expect(service.verifyEmail('valid', context)).resolves.toEqual({
      success: true,
      data: { email: identity.email },
    });
    expect(hashToken).toHaveBeenCalledWith('valid');

    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith({
      event: 'email_verified',
      userId: identity.id,
      email: identity.email,
      ...context,
    });
  });

  it('keeps password reset requests neutral for unknown accounts', async () => {
    repository.findByEmail.mockResolvedValue(null);

    await expect(service.requestPasswordReset(identity.email, context)).resolves.toEqual({
      success: true,
      data: { email: identity.email, requested: true },
    });

    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith({
      event: 'password_reset_requested',
      email: identity.email,
      metadata: { reason: 'unknown_user' },
      ...context,
    });
  });

  it('issues and delivers a password reset token', async () => {
    repository.findByEmail.mockResolvedValue(securityState());
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
  });

  it('does not rotate recently-issued verification tokens', async () => {
    repository.findByEmail.mockResolvedValue(
      securityState({
        emailVerificationTokenHash: 'existing',
        emailVerificationExpires: new Date(Date.now() + 60_000),
      }),
    );
    vi.mocked(wasIssuedRecently).mockReturnValue(true);

    await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
      success: true,
      data: { email: identity.email, requested: true },
    });
    expect(createSecureToken).not.toHaveBeenCalled();
    expect(repository.issueVerificationToken).not.toHaveBeenCalled();
  });

  it('issues a verification token for an eligible account', async () => {
    repository.findByEmail.mockResolvedValue(securityState());
    repository.issueVerificationToken.mockResolvedValue(true);

    await expect(service.resendVerification(identity.email, context)).resolves.toEqual({
      success: true,
      data: { email: identity.email, requested: true },
    });

    await scheduler.runAll();
    expect(notifier.sendVerificationEmail).toHaveBeenCalledWith(identity.email, 'raw-token');
    expect(audit.record).toHaveBeenCalledWith({
      event: 'email_verification_sent',
      userId: identity.id,
      email: identity.email,
      ...context,
    });
  });

  it('resets a password once and defers confirmation side effects', async () => {
    repository.findValidPasswordResetAccount.mockResolvedValue(identity);
    repository.resetPassword.mockResolvedValue(identity);

    await expect(service.resetPassword('raw-reset', 'new-password', context)).resolves.toEqual({
      success: true,
      data: { email: identity.email, passwordReset: true },
    });
    expect(repository.resetPassword).toHaveBeenCalledWith(
      identity.id,
      'hashed:raw-reset',
      'hashed-password:new-password',
      expect.any(Date),
    );

    await scheduler.runAll();
    expect(notifier.sendPasswordChangedEmail).toHaveBeenCalledWith(identity.email);
    expect(audit.record).toHaveBeenCalledWith({
      event: 'password_reset_completed',
      userId: identity.id,
      email: identity.email,
      ...context,
    });
  });

  it('rejects invalid reset tokens before hashing a password', async () => {
    repository.findValidPasswordResetAccount.mockResolvedValue(null);

    await expect(service.resetPassword('invalid', 'new-password', context)).resolves.toEqual({
      success: false,
      error: 'Reset link is invalid or has expired',
      statusCode: 400,
    });
    expect(hashPassword).not.toHaveBeenCalled();
  });
});
