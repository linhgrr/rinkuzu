import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  findOne: vi.fn(),
  findById: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  create: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/models/User', () => ({
  default: {
    findOne: mocks.findOne,
    findById: mocks.findById,
    findOneAndUpdate: mocks.findOneAndUpdate,
    updateOne: mocks.updateOne,
    create: mocks.create,
  },
}));

import { AuthAccountRepository } from '@/repositories/AuthAccountRepository';

const accountId = '507f191e810c19729de860ea';
const now = new Date('2026-07-16T00:00:00.000Z');

function identityRecord(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(accountId),
    email: 'user@example.com',
    role: 'user' as const,
    ...overrides,
  };
}

function queryChain(result: unknown = null) {
  const lean = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ lean });
  return { select, lean };
}

describe('AuthAccountRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = queryChain(null);
    mocks.findOne.mockReturnValue(query);
    mocks.findById.mockReturnValue(query);
    mocks.findOneAndUpdate.mockReturnValue(query);
  });

  it('matches verification tokens through the partial-index type contract', async () => {
    mocks.findOneAndUpdate.mockReturnValue(queryChain(identityRecord()));

    await expect(
      new AuthAccountRepository().verifyEmail('verification-hash', now),
    ).resolves.toMatchObject({
      id: accountId,
      email: 'user@example.com',
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        emailVerificationTokenHash: { $eq: 'verification-hash', $type: 'string' },
        emailVerificationExpires: { $gt: now },
      }),
      expect.objectContaining({
        $set: { emailVerified: now },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
        },
      }),
      { new: true },
    );
  });

  it('matches password-reset tokens through the partial-index type contract', async () => {
    mocks.findOne.mockReturnValue(queryChain(identityRecord()));
    const repository = new AuthAccountRepository();

    await expect(
      repository.findValidPasswordResetAccount('reset-hash', now),
    ).resolves.toMatchObject({ id: accountId });

    expect(mocks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordResetTokenHash: { $eq: 'reset-hash', $type: 'string' },
        passwordResetExpires: { $gt: now },
      }),
    );
  });

  it('keeps the password-reset type guard in the atomic update', async () => {
    mocks.findOneAndUpdate.mockReturnValue(queryChain(identityRecord()));

    await expect(
      new AuthAccountRepository().resetPassword(accountId, 'reset-hash', 'password-hash', now),
    ).resolves.toMatchObject({ id: accountId });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.any(Types.ObjectId),
        passwordResetTokenHash: { $eq: 'reset-hash', $type: 'string' },
        passwordResetExpires: { $gt: now },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          password: 'password-hash',
          passwordChangedAt: now,
          emailVerified: now,
          failedLoginAttempts: 0,
        }),
      }),
      { new: true },
    );
  });

  it('creates pending accounts and returns null on duplicate email', async () => {
    mocks.create
      .mockResolvedValueOnce(identityRecord({ password: 'hash' }))
      .mockRejectedValueOnce({ code: 11000 });

    const repository = new AuthAccountRepository();
    await expect(
      repository.createPending({
        email: 'user@example.com',
        passwordHash: 'hash',
        verificationTokenHash: 'verify-hash',
        verificationExpires: now,
        displayName: 'User',
      }),
    ).resolves.toMatchObject({ email: 'user@example.com' });

    await expect(
      repository.createPending({
        email: 'user@example.com',
        passwordHash: 'hash',
        verificationTokenHash: 'verify-hash',
        verificationExpires: now,
      }),
    ).resolves.toBeNull();
  });

  it('issues password-reset and email-verification tokens with typed filters', async () => {
    mocks.updateOne
      .mockResolvedValueOnce({ matchedCount: 1 })
      .mockResolvedValueOnce({ matchedCount: 0 })
      .mockResolvedValueOnce({ matchedCount: 1 })
      .mockResolvedValueOnce({ matchedCount: 0 });
    const repository = new AuthAccountRepository();

    await expect(
      repository.issuePasswordResetToken('user@example.com', 'reset-hash', now),
    ).resolves.toBe(true);
    await expect(
      repository.issuePasswordResetToken('user@example.com', 'reset-hash', now),
    ).resolves.toBe(false);
    expect(mocks.updateOne).toHaveBeenNthCalledWith(
      1,
      { email: 'user@example.com', password: { $type: 'string' } },
      {
        $set: {
          passwordResetTokenHash: 'reset-hash',
          passwordResetExpires: now,
        },
      },
    );

    await expect(
      repository.issueVerificationToken('user@example.com', 'verify-hash', now),
    ).resolves.toBe(true);
    await expect(
      repository.issueVerificationToken('user@example.com', 'verify-hash', now),
    ).resolves.toBe(false);
    expect(mocks.updateOne).toHaveBeenNthCalledWith(
      3,
      { email: 'user@example.com', password: { $type: 'string' }, emailVerified: null },
      {
        $set: {
          emailVerificationTokenHash: 'verify-hash',
          emailVerificationExpires: now,
        },
      },
    );
  });

  it('loads security, login, and session projections', async () => {
    mocks.findOne
      .mockReturnValueOnce(
        queryChain(
          identityRecord({
            password: 'hash',
            emailVerified: now,
          }),
        ),
      )
      .mockReturnValueOnce(
        queryChain(
          identityRecord({
            password: 'hash',
            failedLoginAttempts: 2,
            lockedUntil: new Date('2026-07-17T00:00:00.000Z'),
          }),
        ),
      );
    mocks.findById.mockReturnValueOnce(
      queryChain(
        identityRecord({
          avatar: 'https://example.com/a.png',
          displayName: 'User',
          passwordChangedAt: now,
        }),
      ),
    );

    const repository = new AuthAccountRepository();
    await expect(repository.findByEmail('user@example.com')).resolves.toMatchObject({
      passwordHash: 'hash',
      emailVerified: now,
    });
    await expect(repository.findLoginAccount('user@example.com')).resolves.toMatchObject({
      failedLoginAttempts: 2,
    });
    await expect(repository.findSessionUser(accountId)).resolves.toMatchObject({
      id: accountId,
      displayName: 'User',
      passwordChangedAt: now.getTime(),
    });
    await expect(repository.findSessionUser('not-an-object-id')).resolves.toBeNull();
  });

  it('records successful logins and google upserts with optional profile fields', async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.findOneAndUpdate.mockReturnValue(
      queryChain(
        identityRecord({
          displayName: 'Google User',
          avatar: 'https://example.com/g.png',
          passwordChangedAt: null,
        }),
      ),
    );
    const repository = new AuthAccountRepository();

    await expect(
      repository.recordSuccessfulLogin(accountId, 'hash', {
        now,
        ip: '127.0.0.1',
        passwordHash: 'new-hash',
      }),
    ).resolves.toBe(true);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(Types.ObjectId), password: 'hash' },
      {
        $set: {
          failedLoginAttempts: 0,
          failedLoginWindowStart: null,
          lockedUntil: null,
          lastLoginAt: now,
          lastLoginIp: '127.0.0.1',
          password: 'new-hash',
        },
      },
    );

    await expect(
      repository.upsertVerifiedGoogleAccount({
        email: 'user@example.com',
        now,
        ip: '127.0.0.1',
        displayName: 'Google User',
        avatar: 'https://example.com/g.png',
      }),
    ).resolves.toMatchObject({
      email: 'user@example.com',
      displayName: 'Google User',
    });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      expect.objectContaining({
        $set: expect.objectContaining({
          displayName: 'Google User',
          avatar: 'https://example.com/g.png',
        }),
        $setOnInsert: { role: 'user' },
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });

  it('maps failed-login lockouts and open attempt windows', async () => {
    mocks.findOneAndUpdate
      .mockReturnValueOnce(
        queryChain({
          failedLoginAttempts: 0,
          lockedUntil: new Date('2026-07-16T00:15:00.000Z'),
        }),
      )
      .mockReturnValueOnce(
        queryChain({
          failedLoginAttempts: 2,
          lockedUntil: null,
        }),
      )
      .mockReturnValueOnce(queryChain(null));

    const repository = new AuthAccountRepository();
    const policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

    await expect(repository.recordFailedLogin(accountId, now, policy)).resolves.toEqual({
      attempts: 5,
      lockedUntil: new Date('2026-07-16T00:15:00.000Z'),
    });
    await expect(repository.recordFailedLogin(accountId, now, policy)).resolves.toEqual({
      attempts: 2,
    });
    await expect(repository.recordFailedLogin(accountId, now, policy)).resolves.toBeNull();
  });
});
