import { Types } from 'mongoose';
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
  IAuthSignInRepository,
  FailedLoginPolicy,
  SuccessfulLoginData,
  VerifiedGoogleAccountData,
} from '@/interfaces/repositories/IAuthAccountRepository';
import { AuthAccountPersistenceMapper } from '@/repositories/mappers/AuthAccountPersistenceMapper';
import type { AuthAccountPersistenceRecord } from '@/repositories/types/AuthAccountPersistence';

const SECURITY_FIELDS =
  'email role password emailVerified emailVerificationTokenHash ' +
  'emailVerificationExpires passwordResetTokenHash passwordResetExpires';

const LOGIN_FIELDS =
  'email role password emailVerified avatar displayName passwordChangedAt ' +
  'failedLoginAttempts failedLoginWindowStart lockedUntil';

const AUTHENTICATED_USER_FIELDS = 'email role avatar displayName passwordChangedAt';

export class AuthAccountRepository implements IAuthAccountRepository, IAuthSignInRepository {
  async findByEmail(email: string): Promise<AuthAccountSecurityState | null> {
    await connectDB();
    const record = await User.findOne({ email })
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
        ...(data.displayName ? { displayName: data.displayName } : {}),
        emailVerificationTokenHash: data.verificationTokenHash,
        emailVerificationExpires: data.verificationExpires,
      });
      return AuthAccountPersistenceMapper.toIdentity({
        _id: user._id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async verifyEmail(tokenHash: string, now: Date): Promise<AuthAccountIdentity | null> {
    await connectDB();
    const record = await User.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: { $gt: now },
      },
      {
        $set: { emailVerified: now },
        $unset: {
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

  async issuePasswordResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      { email, password: { $type: 'string' } },
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
      { email, password: { $type: 'string' }, emailVerified: null },
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
      passwordResetTokenHash: tokenHash,
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
    await connectDB();
    const record = await User.findOneAndUpdate(
      {
        _id: new Types.ObjectId(accountId),
        passwordResetTokenHash: tokenHash,
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
    const record = await User.findOne({ email })
      .select(LOGIN_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toLoginAccount(record) : null;
  }

  async findSessionUser(accountId: string): Promise<AuthenticatedUser | null> {
    if (!Types.ObjectId.isValid(accountId)) return null;
    await connectDB();
    const record = await User.findById(accountId)
      .select(AUTHENTICATED_USER_FIELDS)
      .lean<AuthAccountPersistenceRecord>();
    return record ? AuthAccountPersistenceMapper.toAuthenticatedUser(record) : null;
  }

  async recordFailedLogin(
    accountId: string,
    now: Date,
    policy: FailedLoginPolicy,
  ): Promise<FailedLoginAttemptState | null> {
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
      { _id: new Types.ObjectId(accountId) },
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
  ): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      { _id: new Types.ObjectId(accountId), password: expectedPasswordHash },
      {
        $set: {
          failedLoginAttempts: 0,
          failedLoginWindowStart: null,
          lockedUntil: null,
          lastLoginAt: data.now,
          lastLoginIp: data.ip,
          ...(data.passwordHash ? { password: data.passwordHash } : {}),
        },
      },
    );
    return result.matchedCount === 1;
  }

  async upsertVerifiedGoogleAccount(data: VerifiedGoogleAccountData): Promise<AuthenticatedUser> {
    await connectDB();
    const record = await User.findOneAndUpdate(
      { email: data.email },
      {
        $set: {
          email: data.email,
          emailVerified: data.now,
          lastLoginAt: data.now,
          lastLoginIp: data.ip,
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.avatar ? { avatar: data.avatar } : {}),
        },
        $setOnInsert: { role: 'user' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .select(AUTHENTICATED_USER_FIELDS)
      .lean<AuthAccountPersistenceRecord>();

    if (!record) throw new Error('Google account upsert did not return a user');
    return AuthAccountPersistenceMapper.toAuthenticatedUser(record);
  }
}
