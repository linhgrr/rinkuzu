import { Types, type ModifyResult } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type {
  AuthAccountIdentity,
  AuthAccountSecurityState,
  AuthenticatedUser,
  AuthLoginAccount,
  FailedLoginAttemptState,
} from '@/entities/AuthAccount';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import type {
  CreatePendingAccountData,
  IAuthAccountRepository,
  VerifiedEmailAccount,
  IAuthSignInRepository,
  FailedLoginPolicy,
  ResolvedGoogleAccount,
  SuccessfulLoginData,
  VerifiedGoogleAccountData,
} from '@/interfaces/repositories/IAuthAccountRepository';
import { AuthAccountPersistenceMapper } from '@/repositories/mappers/AuthAccountPersistenceMapper';
import { matchIndexedString } from '@/repositories/filters/indexed-string';
import type { AuthAccountPersistenceRecord } from '@/repositories/types/AuthAccountPersistence';
import { ACCOUNT_DISABLE_ACTIVE, ACTIVE_ACCOUNT_FILTER } from '@/shared/constants/account-disable';

const SECURITY_FIELDS =
  'email role password authIdentities emailVerified emailVerificationTokenHash ' +
  'emailVerificationExpires passwordResetTokenHash passwordResetExpires';

const LOGIN_FIELDS =
  'email role password emailVerified avatar displayName passwordChangedAt authVersion ' +
  'failedLoginAttempts failedLoginWindowStart lockedUntil';

const AUTHENTICATED_USER_FIELDS =
  'email role emailVerified avatar displayName passwordChangedAt authVersion';

interface GoogleProfileUpdates {
  emailVerified: Date;
  lastLoginAt: Date;
  lastLoginIp: string | null;
  displayName?: string;
  avatar?: string;
}

function buildGoogleProfileUpdates(data: VerifiedGoogleAccountData): GoogleProfileUpdates {
  return {
    emailVerified: data.now,
    lastLoginAt: data.now,
    lastLoginIp: data.ip,
    ...(data.displayName ? { displayName: data.displayName } : {}),
    ...(data.avatar ? { avatar: data.avatar } : {}),
  };
}

export class AuthAccountRepository implements IAuthAccountRepository, IAuthSignInRepository {
  async findByEmail(email: string): Promise<AuthAccountSecurityState | null> {
    await connectDB();
    const record = await User.findOne({ email, ...ACTIVE_ACCOUNT_FILTER })
      .select(SECURITY_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toSecurityState(record) : null;
  }

  async createPending(data: CreatePendingAccountData): Promise<AuthAccountIdentity | null> {
    await connectDB();
    try {
      const user = await User.create({
        email: data.email,
        password: data.passwordHash,
        role: 'user',
        disable: ACCOUNT_DISABLE_ACTIVE,
        authVersion: 0,
        disabledAt: null,
        disabledBy: null,
        ...(data.displayName ? { displayName: data.displayName } : {}),
        emailVerificationTokenHash: data.verificationTokenHash,
        emailVerificationExpires: data.verificationExpires,
        ...(data.guestClaimHashes?.length ? { guestClaimHashes: data.guestClaimHashes } : {}),
      });
      return AuthAccountPersistenceMapper.toIdentity({
        _id: user._id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      // Includes globally unique email collisions with disabled accounts — no existence leak.
      if (isMongoDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async verifyEmail(tokenHash: string, now: Date): Promise<VerifiedEmailAccount | null> {
    await connectDB();
    const record = await User.findOneAndUpdate(
      {
        ...ACTIVE_ACCOUNT_FILTER,
        emailVerificationTokenHash: matchIndexedString(tokenHash),
        emailVerificationExpires: { $gt: now },
      },
      {
        $set: { emailVerified: now },
        $unset: {
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
          guestClaimHashes: 1,
        },
      },
      // The pre-image: it still holds the guest claim hashes this update removes (RIN-1310).
      { new: false },
    )
      .select('email role guestClaimHashes')
      .lean<AuthAccountPersistenceRecord>();
    if (!record) return null;
    const identity = AuthAccountPersistenceMapper.toIdentity(record);
    return record.guestClaimHashes?.length
      ? { ...identity, guestClaimHashes: record.guestClaimHashes }
      : identity;
  }

  async issuePasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      { email, ...ACTIVE_ACCOUNT_FILTER },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: expiresAt,
        },
      },
    );
    return result.matchedCount === 1;
  }

  async issueVerificationToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      {
        email,
        password: { $type: 'string' },
        emailVerified: null,
        ...ACTIVE_ACCOUNT_FILTER,
      },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: expiresAt,
        },
      },
    );
    return result.matchedCount === 1;
  }

  async findValidPasswordResetAccount(
    tokenHash: string,
    now: Date,
  ): Promise<AuthAccountIdentity | null> {
    await connectDB();
    const record = await User.findOne({
      ...ACTIVE_ACCOUNT_FILTER,
      passwordResetTokenHash: matchIndexedString(tokenHash),
      passwordResetExpires: { $gt: now },
    })
      .select('email role')
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toIdentity(record) : null;
  }

  async resetPassword(
    accountId: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<AuthAccountIdentity | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    const record = await User.findOneAndUpdate(
      {
        _id: new Types.ObjectId(accountId),
        ...ACTIVE_ACCOUNT_FILTER,
        passwordResetTokenHash: matchIndexedString(tokenHash),
        passwordResetExpires: { $gt: now },
      },
      {
        $set: {
          password: passwordHash,
          passwordChangedAt: now,
          emailVerified: now,
          failedLoginAttempts: 0,
        },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpires: 1,
          failedLoginWindowStart: 1,
          lockedUntil: 1,
          emailVerificationTokenHash: 1,
          emailVerificationExpires: 1,
        },
      },
      { new: true },
    )
      .select('email role')
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toIdentity(record) : null;
  }

  async findLoginAccount(email: string): Promise<AuthLoginAccount | null> {
    await connectDB();
    const record = await User.findOne({ email, ...ACTIVE_ACCOUNT_FILTER })
      .select(LOGIN_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toLoginAccount(record) : null;
  }

  async findSessionUser(accountId: string): Promise<AuthenticatedUser | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    const record = await User.findOne({
      _id: new Types.ObjectId(accountId),
      ...ACTIVE_ACCOUNT_FILTER,
    })
      .select(AUTHENTICATED_USER_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toAuthenticatedUser(record) : null;
  }

  async recordFailedLogin(
    accountId: string,
    now: Date,
    policy: FailedLoginPolicy,
  ): Promise<FailedLoginAttemptState | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    const windowFloor = new Date(now.getTime() - policy.windowMs);
    const nextAttempts = {
      $add: [
        {
          $cond: [
            {
              $and: [
                { $ne: [{ $ifNull: ['$failedLoginWindowStart', null] }, null] },
                { $gte: ['$failedLoginWindowStart', windowFloor] },
              ],
            },
            { $ifNull: ['$failedLoginAttempts', 0] },
            0,
          ],
        },
        1,
      ],
    };
    const shouldLock = { $gte: [nextAttempts, policy.maxAttempts] };

    const record = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(accountId), ...ACTIVE_ACCOUNT_FILTER },
      [
        {
          $set: {
            failedLoginAttempts: { $cond: [shouldLock, 0, nextAttempts] },
            failedLoginWindowStart: {
              $cond: [
                shouldLock,
                null,
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: [{ $ifNull: ['$failedLoginWindowStart', null] }, null] },
                        { $gte: ['$failedLoginWindowStart', windowFloor] },
                      ],
                    },
                    '$failedLoginWindowStart',
                    now,
                  ],
                },
              ],
            },
            lockedUntil: {
              $cond: [shouldLock, new Date(now.getTime() + policy.lockoutMs), null],
            },
          },
        },
      ],
      { new: true },
    )
      .select('failedLoginAttempts lockedUntil')
      .lean<Pick<AuthAccountPersistenceRecord, 'failedLoginAttempts' | 'lockedUntil'>>();

    if (!record) return null;
    const lockedUntil = record.lockedUntil ?? undefined;
    return {
      attempts: lockedUntil ? policy.maxAttempts : (record.failedLoginAttempts ?? 0),
      ...(lockedUntil ? { lockedUntil } : {}),
    };
  }

  async recordSuccessfulLogin(
    accountId: string,
    expectedPasswordHash: string,
    data: SuccessfulLoginData,
  ): Promise<AuthenticatedUser | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    // CAS: _id + expected password hash + exact disable:0 + expected authVersion.
    // A disable+restore between credential read and this write bumps authVersion
    // and must fail closed (no stale successful login).
    // Incrementing authVersion atomically makes this the account's only active
    // login; every previously issued JWT immediately becomes stale.
    const record = await User.findOneAndUpdate(
      {
        _id: new Types.ObjectId(accountId),
        password: expectedPasswordHash,
        authVersion: data.expectedAuthVersion,
        ...ACTIVE_ACCOUNT_FILTER,
      },
      {
        $set: {
          failedLoginAttempts: 0,
          failedLoginWindowStart: null,
          lockedUntil: null,
          lastLoginAt: data.now,
          lastLoginIp: data.ip,
          ...(data.passwordHash ? { password: data.passwordHash } : {}),
        },
        $inc: { authVersion: 1 },
      },
      { new: true },
    )
      .select(AUTHENTICATED_USER_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toAuthenticatedUser(record) : null;
  }

  async resolveVerifiedGoogleAccount(
    data: VerifiedGoogleAccountData,
  ): Promise<ResolvedGoogleAccount | null> {
    await connectDB();
    try {
      const identity = { provider: 'google', subject: data.subject };
      const linkedRecord = await User.findOneAndUpdate(
        { authIdentities: { $elemMatch: identity }, ...ACTIVE_ACCOUNT_FILTER },
        {
          $set: buildGoogleProfileUpdates(data),
          $inc: { authVersion: 1 },
        },
        { new: true },
      )
        .select(AUTHENTICATED_USER_FIELDS)
        .lean<AuthAccountPersistenceRecord>();
      if (linkedRecord) {
        return {
          ...AuthAccountPersistenceMapper.toAuthenticatedUser(linkedRecord),
          isNewAccount: false,
        };
      }

      const result = await User.findOneAndUpdate(
        { email: data.email, ...ACTIVE_ACCOUNT_FILTER },
        {
          $set: {
            email: data.email,
            ...buildGoogleProfileUpdates(data),
          },
          $addToSet: { authIdentities: identity },
          $setOnInsert: {
            role: 'user',
            disable: ACCOUNT_DISABLE_ACTIVE,
            disabledAt: null,
            disabledBy: null,
          },
          $inc: { authVersion: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
      )
        .select(AUTHENTICATED_USER_FIELDS)
        .lean<ModifyResult<AuthAccountPersistenceRecord>>();

      const record = result?.value;
      if (!record) return null;
      return {
        ...AuthAccountPersistenceMapper.toAuthenticatedUser(record),
        // updatedExisting=false means the upsert inserted: this is a brand-new account.
        isNewAccount: result.lastErrorObject?.updatedExisting === false,
      };
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        const identity = { provider: 'google', subject: data.subject };
        const record = await User.findOneAndUpdate(
          {
            authIdentities: { $elemMatch: identity },
            ...ACTIVE_ACCOUNT_FILTER,
          },
          {
            $set: buildGoogleProfileUpdates(data),
            $inc: { authVersion: 1 },
          },
          { new: true },
        )
          .select(AUTHENTICATED_USER_FIELDS)
          .lean<AuthAccountPersistenceRecord>();
        return record
          ? { ...AuthAccountPersistenceMapper.toAuthenticatedUser(record), isNewAccount: false }
          : null;
      }
      throw error;
    }
  }
}
