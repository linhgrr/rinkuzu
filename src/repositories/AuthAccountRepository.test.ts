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
    mocks.connectDB.mockReset();
    mocks.findOne.mockReset();
    mocks.findById.mockReset();
    mocks.findOneAndUpdate.mockReset();
    mocks.updateOne.mockReset();
    mocks.create.mockReset();
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
        disable: 0,
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
    expect(mocks.findOneAndUpdate.mock.results[0]?.value.select).toHaveBeenCalledWith('email role');
  });

  it('matches password-reset tokens through the partial-index type contract', async () => {
    mocks.findOne.mockReturnValue(queryChain(identityRecord()));
    const repository = new AuthAccountRepository();

    await expect(
      repository.findValidPasswordResetAccount('reset-hash', now),
    ).resolves.toMatchObject({ id: accountId });

    expect(mocks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        disable: 0,
        passwordResetTokenHash: { $eq: 'reset-hash', $type: 'string' },
        passwordResetExpires: { $gt: now },
      }),
    );
    expect(mocks.findOne.mock.results[0]?.value.select).toHaveBeenCalledWith('email role');
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
        locale: 'en',
      }),
    ).resolves.toMatchObject({ email: 'user@example.com' });
    expect(mocks.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hash',
      role: 'user',
      disable: 0,
      authVersion: 0,
      disabledAt: null,
      disabledBy: null,
      displayName: 'User',
      locale: 'en',
      emailVerificationTokenHash: 'verify-hash',
      emailVerificationExpires: now,
    });

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
      { email: 'user@example.com', disable: 0 },
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
      {
        email: 'user@example.com',
        password: { $type: 'string' },
        emailVerified: null,
        disable: 0,
      },
      {
        $set: {
          emailVerificationTokenHash: 'verify-hash',
          emailVerificationExpires: now,
        },
      },
    );
  });

  it('loads security, login, and session projections for active accounts only', async () => {
    const securitySelect =
      'email role password authIdentities emailVerified emailVerificationTokenHash ' +
      'emailVerificationExpires passwordResetTokenHash passwordResetExpires';
    const loginSelect =
      'email role password emailVerified avatar displayName passwordChangedAt authVersion ' +
      'failedLoginAttempts failedLoginWindowStart lockedUntil';
    const sessionSelect =
      'email role emailVerified avatar displayName passwordChangedAt authVersion';

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
            authVersion: 2,
            failedLoginAttempts: 2,
            lockedUntil: new Date('2026-07-17T00:00:00.000Z'),
          }),
        ),
      )
      .mockReturnValueOnce(
        queryChain(
          identityRecord({
            avatar: 'https://example.com/a.png',
            displayName: 'User',
            passwordChangedAt: now,
            authVersion: 2,
          }),
        ),
      );

    const repository = new AuthAccountRepository();
    await expect(repository.findByEmail('user@example.com')).resolves.toMatchObject({
      passwordHash: 'hash',
      emailVerified: now,
    });
    expect(mocks.findOne).toHaveBeenNthCalledWith(1, {
      email: 'user@example.com',
      disable: 0,
    });
    expect(mocks.findOne.mock.results[0]?.value.select).toHaveBeenCalledWith(securitySelect);

    await expect(repository.findLoginAccount('user@example.com')).resolves.toMatchObject({
      failedLoginAttempts: 2,
      authVersion: 2,
    });
    expect(mocks.findOne).toHaveBeenNthCalledWith(2, {
      email: 'user@example.com',
      disable: 0,
    });
    expect(mocks.findOne.mock.results[1]?.value.select).toHaveBeenCalledWith(loginSelect);

    await expect(repository.findSessionUser(accountId)).resolves.toMatchObject({
      id: accountId,
      displayName: 'User',
      passwordChangedAt: now.getTime(),
      authVersion: 2,
    });
    expect(mocks.findOne).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        disable: 0,
      }),
    );
    expect(mocks.findOne.mock.results[2]?.value.select).toHaveBeenCalledWith(sessionSelect);
    await expect(repository.findSessionUser('not-an-object-id')).resolves.toBeNull();
  });

  it('returns null when security or login accounts are missing', async () => {
    mocks.findOne.mockReturnValue(queryChain(null));
    const repository = new AuthAccountRepository();
    await expect(repository.findByEmail('missing@example.com')).resolves.toBeNull();
    await expect(repository.findLoginAccount('missing@example.com')).resolves.toBeNull();
  });

  it('creates pending accounts without optional displayName and rethrows non-duplicate errors', async () => {
    mocks.create
      .mockResolvedValueOnce(identityRecord({ password: 'hash' }))
      .mockRejectedValueOnce(new Error('write concern failed'));

    const repository = new AuthAccountRepository();
    await repository.createPending({
      email: 'user@example.com',
      passwordHash: 'hash',
      verificationTokenHash: 'verify-hash',
      verificationExpires: now,
    });
    expect(mocks.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'hash',
      role: 'user',
      disable: 0,
      authVersion: 0,
      disabledAt: null,
      disabledBy: null,
      emailVerificationTokenHash: 'verify-hash',
      emailVerificationExpires: now,
    });
    expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty('displayName');

    // Second call must use the rejected mock (first resolved already consumed).
    await expect(
      repository.createPending({
        email: 'user@example.com',
        passwordHash: 'hash',
        verificationTokenHash: 'verify-hash',
        verificationExpires: now,
      }),
    ).rejects.toThrow('write concern failed');
  });

  it('unsets every password-reset and verification field on successful reset', async () => {
    mocks.findOneAndUpdate.mockReturnValue(queryChain(identityRecord()));

    await new AuthAccountRepository().resetPassword(accountId, 'reset-hash', 'password-hash', now);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpires: 1,
          failedLoginWindowStart: 1,
          lockedUntil: 1,
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
        },
      }),
      { new: true },
    );
    expect(mocks.findOneAndUpdate.mock.results[0]?.value.select).toHaveBeenCalledWith('email role');
  });

  it('records successful logins and google upserts with optional profile fields', async () => {
    mocks.findOneAndUpdate
      .mockReturnValueOnce(
        queryChain(
          identityRecord({
            displayName: 'User',
            passwordChangedAt: null,
            authVersion: 1,
          }),
        ),
      )
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce(
        queryChain(
          identityRecord({
            displayName: 'User',
            passwordChangedAt: null,
            authVersion: 1,
          }),
        ),
      )
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce(
        queryChain({
          value: identityRecord({
            displayName: 'Google User',
            avatar: 'https://example.com/g.png',
            passwordChangedAt: null,
            authVersion: 1,
          }),
          lastErrorObject: { updatedExisting: true },
        }),
      )
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce(queryChain(null));
    const repository = new AuthAccountRepository();

    await expect(
      repository.recordSuccessfulLogin(accountId, 'hash', {
        now,
        ip: '127.0.0.1',
        expectedAuthVersion: 0,
        passwordHash: 'new-hash',
      }),
    ).resolves.toMatchObject({ authVersion: 1 });
    expect(mocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      {
        _id: expect.any(Types.ObjectId),
        password: 'hash',
        authVersion: 0,
        disable: 0,
      },
      {
        $set: {
          failedLoginAttempts: 0,
          failedLoginWindowStart: null,
          lockedUntil: null,
          lastLoginAt: now,
          lastLoginIp: '127.0.0.1',
          password: 'new-hash',
        },
        $inc: { authVersion: 1 },
      },
      { new: true },
    );

    await expect(
      repository.recordSuccessfulLogin(accountId, 'wrong-hash', {
        now,
        ip: '127.0.0.1',
        expectedAuthVersion: 0,
      }),
    ).resolves.toBeNull();

    await expect(
      repository.recordSuccessfulLogin(accountId, 'hash', {
        now,
        ip: '10.0.0.1',
        expectedAuthVersion: 0,
      }),
    ).resolves.toMatchObject({ authVersion: 1 });

    await expect(
      repository.resolveVerifiedGoogleAccount({
        subject: 'google-sub',
        email: 'user@example.com',
        now,
        ip: '127.0.0.1',
        displayName: 'Google User',
        avatar: 'https://example.com/g.png',
      }),
    ).resolves.toMatchObject({
      email: 'user@example.com',
      displayName: 'Google User',
      authVersion: 1,
      isNewAccount: false,
    });
    expect(mocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      5,
      { email: 'user@example.com', disable: 0 },
      expect.objectContaining({
        $set: expect.objectContaining({
          displayName: 'Google User',
          avatar: 'https://example.com/g.png',
          emailVerified: now,
          lastLoginAt: now,
          lastLoginIp: '127.0.0.1',
        }),
        $setOnInsert: {
          role: 'user',
          disable: 0,
          disabledAt: null,
          disabledBy: null,
        },
        $inc: { authVersion: 1 },
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
    );

    await expect(
      repository.resolveVerifiedGoogleAccount({
        subject: 'google-sub',
        email: 'user@example.com',
        now,
        ip: '127.0.0.1',
      }),
    ).resolves.toBeNull();
  });

  it('reports isNewAccount only when the Google upsert inserted a new user', async () => {
    const googleRecord = identityRecord({ passwordChangedAt: null, authVersion: 1 });
    mocks.findOneAndUpdate
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce(
        queryChain({ value: googleRecord, lastErrorObject: { updatedExisting: false } }),
      )
      .mockReturnValueOnce(queryChain(googleRecord));
    const repository = new AuthAccountRepository();
    const input = { subject: 'google-sub', email: 'user@example.com', now, ip: null };

    await expect(repository.resolveVerifiedGoogleAccount(input)).resolves.toMatchObject({
      email: 'user@example.com',
      isNewAccount: true,
    });
    // Returning user: the linked-identity lookup matches, so nothing is inserted.
    await expect(repository.resolveVerifiedGoogleAccount(input)).resolves.toMatchObject({
      email: 'user@example.com',
      isNewAccount: false,
    });
  });

  it('does not report a new account when the upsert result carries no write metadata', async () => {
    mocks.findOneAndUpdate
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce(
        queryChain({ value: identityRecord({ passwordChangedAt: null, authVersion: 1 }) }),
      );

    await expect(
      new AuthAccountRepository().resolveVerifiedGoogleAccount({
        subject: 'google-sub',
        email: 'user@example.com',
        now,
        ip: null,
      }),
    ).resolves.toMatchObject({ email: 'user@example.com', isNewAccount: false });
  });

  it('treats a concurrent Google sign-in that won the E11000 race as a returning account', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key error'), {
      code: 11000,
      keyPattern: { email: 1 },
    });
    mocks.findOneAndUpdate
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce({
        select: () => ({
          lean: vi.fn().mockRejectedValueOnce(duplicateKeyError),
        }),
      })
      .mockReturnValueOnce(queryChain(identityRecord({ passwordChangedAt: null, authVersion: 2 })));

    await expect(
      new AuthAccountRepository().resolveVerifiedGoogleAccount({
        subject: 'google-sub',
        email: 'user@example.com',
        now,
        ip: '127.0.0.1',
      }),
    ).resolves.toMatchObject({ email: 'user@example.com', isNewAccount: false });
  });

  it('rejects Google upsert generically on E11000 disabled-email collision', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key error'), {
      code: 11000,
      keyPattern: { email: 1 },
    });
    // Mongoose chain rejects at lean() when the upsert hits the unique email index.
    mocks.findOneAndUpdate
      .mockReturnValueOnce(queryChain(null))
      .mockReturnValueOnce({
        select: () => ({
          lean: vi.fn().mockRejectedValueOnce(duplicateKeyError),
        }),
      })
      .mockReturnValueOnce(queryChain(null));

    await expect(
      new AuthAccountRepository().resolveVerifiedGoogleAccount({
        subject: 'disabled-google-sub',
        email: 'disabled-owner@example.com',
        now,
        ip: '127.0.0.1',
      }),
    ).resolves.toBeNull();
  });

  it('fails successful-login CAS when authVersion diverges after disable/restore', async () => {
    mocks.findOneAndUpdate.mockReturnValueOnce(queryChain(null));

    await expect(
      new AuthAccountRepository().recordSuccessfulLogin(accountId, 'hash', {
        now,
        ip: '127.0.0.1',
        expectedAuthVersion: 0,
      }),
    ).resolves.toBeNull();

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: expect.anything(),
        password: 'hash',
        authVersion: 0,
        disable: 0,
      },
      expect.any(Object),
      { new: true },
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

  it('rejects malformed account ids before login mutation queries', async () => {
    const repository = new AuthAccountRepository();
    const policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };

    await expect(repository.recordFailedLogin('invalid-id', now, policy)).resolves.toBeNull();
    await expect(
      repository.recordSuccessfulLogin('invalid-id', 'hash', {
        now,
        ip: '127.0.0.1',
        expectedAuthVersion: 0,
      }),
    ).resolves.toBeNull();
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('stores a locale only on an account that has none (RIN-1263)', async () => {
    const repository = new AuthAccountRepository();
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await repository.rememberLocaleIfMissing(accountId, 'en');
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(accountId), locale: null },
      { $set: { locale: 'en' } },
    );

    mocks.updateOne.mockClear();
    await repository.rememberLocaleIfMissing('invalid-id', 'vi');
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('builds the failed-login window floor and lockout pipeline from policy timings', async () => {
    mocks.findOneAndUpdate.mockReturnValue(
      queryChain({ failedLoginAttempts: 1, lockedUntil: null }),
    );
    const policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 30 * 60_000 };
    const windowFloor = new Date(now.getTime() - policy.windowMs);
    const lockoutUntil = new Date(now.getTime() + policy.lockoutMs);
    const inWindow = {
      $and: [
        { $ne: [{ $ifNull: ['$failedLoginWindowStart', null] }, null] },
        { $gte: ['$failedLoginWindowStart', windowFloor] },
      ],
    };
    const nextAttempts = {
      $add: [
        {
          $cond: [inWindow, { $ifNull: ['$failedLoginAttempts', 0] }, 0],
        },
        1,
      ],
    };
    const shouldLock = { $gte: [nextAttempts, policy.maxAttempts] };

    await new AuthAccountRepository().recordFailedLogin(accountId, now, policy);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(Types.ObjectId), disable: 0 },
      [
        {
          $set: {
            failedLoginAttempts: { $cond: [shouldLock, 0, nextAttempts] },
            failedLoginWindowStart: {
              $cond: [
                shouldLock,
                null,
                {
                  $cond: [inWindow, '$failedLoginWindowStart', now],
                },
              ],
            },
            lockedUntil: {
              $cond: [shouldLock, lockoutUntil, null],
            },
          },
        },
      ],
      { new: true },
    );
    expect(mocks.findOneAndUpdate.mock.results[0]?.value.select).toHaveBeenCalledWith(
      'failedLoginAttempts lockedUntil',
    );
  });
});
