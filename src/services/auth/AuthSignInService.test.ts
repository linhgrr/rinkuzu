import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AuthenticatedUser,
  AuthLoginAccount,
  FailedLoginAttemptState,
} from '@/entities/AuthAccount';
import type {
  FailedLoginPolicy,
  IAuthSignInRepository,
  SuccessfulLoginData,
  VerifiedGoogleAccountData,
} from '@/interfaces/repositories/IAuthAccountRepository';
import type { AuthAuditRecord, IAuthAudit } from '@/interfaces/services/IAuthAudit';
import type { IAuthRateLimiter } from '@/interfaces/services/IAuthRateLimiter';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import { hashPassword, verifyPassword } from '@/lib/password';
import { AuthSignInService } from '@/services/auth/AuthSignInService';

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn(async () => 'new-argon2-hash'),
  verifyPassword: vi.fn(),
}));

const context = { ip: '203.0.113.7', userAgent: 'vitest' };
const policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
const account: AuthLoginAccount = {
  id: '507f191e810c19729de860ea',
  email: 'user@example.com',
  role: 'user',
  passwordHash: 'stored-hash',
  emailVerified: new Date('2026-01-01T00:00:00.000Z'),
  displayName: 'Rin',
  failedLoginAttempts: 0,
};

class SignInRepositoryStub implements IAuthSignInRepository {
  findLoginAccount = vi.fn<(email: string) => Promise<AuthLoginAccount | null>>();
  findSessionUser = vi.fn<(accountId: string) => Promise<AuthenticatedUser | null>>();
  recordFailedLogin =
    vi.fn<
      (
        accountId: string,
        now: Date,
        policy: FailedLoginPolicy,
      ) => Promise<FailedLoginAttemptState | null>
    >();
  recordSuccessfulLogin =
    vi.fn<
      (
        accountId: string,
        expectedPasswordHash: string,
        data: SuccessfulLoginData,
      ) => Promise<boolean>
    >();
  upsertVerifiedGoogleAccount =
    vi.fn<(data: VerifiedGoogleAccountData) => Promise<AuthenticatedUser>>();
}

class RateLimiterStub implements IAuthRateLimiter {
  consume = vi.fn<IAuthRateLimiter['consume']>();
}

class AuthAuditStub implements IAuthAudit {
  record = vi.fn<(input: AuthAuditRecord) => Promise<void>>();
}

class DeferredSchedulerStub implements IDeferredTaskScheduler {
  readonly tasks: Array<() => Promise<void>> = [];

  schedule = vi.fn((task: () => Promise<void>) => {
    this.tasks.push(task);
  });

  async runAll(): Promise<void> {
    await Promise.all(this.tasks.map((task) => task()));
  }
}

describe('AuthSignInService', () => {
  let repository: SignInRepositoryStub;
  let rateLimiter: RateLimiterStub;
  let audit: AuthAuditStub;
  let scheduler: DeferredSchedulerStub;
  let service: AuthSignInService;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SignInRepositoryStub();
    rateLimiter = new RateLimiterStub();
    audit = new AuthAuditStub();
    scheduler = new DeferredSchedulerStub();
    service = new AuthSignInService(repository, rateLimiter, audit, scheduler, policy);

    rateLimiter.consume.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetSeconds: 60,
      limit: 10,
    });
    repository.recordSuccessfulLogin.mockResolvedValue(true);
    audit.record.mockResolvedValue();
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: true,
      algorithm: 'argon2id',
      needsRehash: false,
    });
  });

  it('rate limits by IP and a SHA-256 identity key before reading an account', async () => {
    rateLimiter.consume
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 90, limit: 20 })
      .mockResolvedValueOnce({ allowed: true, remaining: 9, resetSeconds: 60, limit: 10 });

    await expect(
      service.authenticateCredentials(
        { email: ' User@Example.com ', password: 'password' },
        context,
      ),
    ).resolves.toEqual({
      success: false,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: 90,
    });
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(1, 'credentials_ip', context.ip);
    expect(rateLimiter.consume).toHaveBeenNthCalledWith(
      2,
      'credentials_identity',
      createHash('sha256').update(account.email).digest('hex'),
    );
    expect(repository.findLoginAccount).not.toHaveBeenCalled();
  });

  it('verifies a dummy hash and returns a neutral failure for unknown users', async () => {
    repository.findLoginAccount.mockResolvedValue(null);
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: false,
      algorithm: 'argon2id',
      needsRehash: false,
    });

    await expect(
      service.authenticateCredentials({ email: account.email, password: 'wrong' }, context),
    ).resolves.toEqual({ success: false, code: 'invalid_credentials' });
    expect(verifyPassword).toHaveBeenCalledWith('wrong', expect.any(String));
    expect(repository.recordFailedLogin).not.toHaveBeenCalled();

    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'login_failed',
        email: account.email,
        metadata: { reason: 'unknown_user_or_passwordless' },
      }),
    );
  });

  it('does not reveal an active lock when the password is wrong', async () => {
    repository.findLoginAccount.mockResolvedValue({
      ...account,
      lockedUntil: new Date(Date.now() + 5 * 60_000),
    });
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: false,
      algorithm: 'argon2id',
      needsRehash: false,
    });

    await expect(
      service.authenticateCredentials({ email: account.email, password: 'wrong' }, context),
    ).resolves.toEqual({ success: false, code: 'invalid_credentials' });
    expect(repository.recordFailedLogin).not.toHaveBeenCalled();
  });

  it('returns lock duration only after the password is verified', async () => {
    repository.findLoginAccount.mockResolvedValue({
      ...account,
      lockedUntil: new Date(Date.now() + 5 * 60_000),
    });

    const result = await service.authenticateCredentials(
      { email: account.email, password: 'correct' },
      context,
    );

    expect(result).toMatchObject({ success: false, code: 'account_locked' });
    if (!result.success && result.code === 'account_locked') {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(repository.recordSuccessfulLogin).not.toHaveBeenCalled();
  });

  it('checks verification before success telemetry or password rehash', async () => {
    const { emailVerified: _emailVerified, ...accountWithoutVerification } = account;
    void _emailVerified;
    repository.findLoginAccount.mockResolvedValue(accountWithoutVerification);

    await expect(
      service.authenticateCredentials({ email: account.email, password: 'correct' }, context),
    ).resolves.toEqual({ success: false, code: 'email_not_verified' });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(repository.recordSuccessfulLogin).not.toHaveBeenCalled();
  });

  it('records failed attempts through the atomic repository operation', async () => {
    repository.findLoginAccount.mockResolvedValue(account);
    repository.recordFailedLogin.mockResolvedValue({ attempts: 5, lockedUntil: new Date() });
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: false,
      algorithm: 'argon2id',
      needsRehash: false,
    });

    await service.authenticateCredentials({ email: account.email, password: 'wrong' }, context);

    expect(repository.recordFailedLogin).toHaveBeenCalledWith(account.id, expect.any(Date), policy);
    await scheduler.runAll();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'account_locked', metadata: { attempts: 5 } }),
    );
  });

  it('rehashes legacy passwords and returns the Mongo identity', async () => {
    repository.findLoginAccount.mockResolvedValue({
      ...account,
      avatar: 'https://example.com/avatar.png',
      passwordChangedAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    vi.mocked(verifyPassword).mockResolvedValue({
      valid: true,
      algorithm: 'bcrypt',
      needsRehash: true,
    });

    const result = await service.authenticateCredentials(
      { email: account.email, password: 'correct' },
      context,
    );

    expect(result).toEqual({
      success: true,
      user: {
        id: account.id,
        email: account.email,
        role: account.role,
        avatar: 'https://example.com/avatar.png',
        displayName: account.displayName,
        passwordChangedAt: new Date('2026-02-01T00:00:00.000Z').getTime(),
      },
    });
    expect(repository.recordSuccessfulLogin).toHaveBeenCalledWith(
      account.id,
      account.passwordHash,
      expect.objectContaining({ passwordHash: 'new-argon2-hash', ip: context.ip }),
    );
  });

  it('rejects unverified Google profiles and upserts a verified profile once', async () => {
    await expect(
      service.authenticateGoogle({ email: account.email, emailVerified: false }, context),
    ).resolves.toEqual({ success: false, code: 'invalid_google_profile' });
    expect(repository.upsertVerifiedGoogleAccount).not.toHaveBeenCalled();

    const googleUser: AuthenticatedUser = {
      id: account.id,
      email: account.email,
      role: account.role,
      displayName: 'Rin',
      passwordChangedAt: null,
    };
    repository.upsertVerifiedGoogleAccount.mockResolvedValue(googleUser);

    await expect(
      service.authenticateGoogle(
        { email: ' USER@example.com ', emailVerified: true, displayName: ' Rin ' },
        context,
      ),
    ).resolves.toEqual({ success: true, user: googleUser });
    expect(repository.upsertVerifiedGoogleAccount).toHaveBeenCalledTimes(1);
    expect(repository.upsertVerifiedGoogleAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: account.email, displayName: 'Rin', ip: context.ip }),
    );
  });
});
