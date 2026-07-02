import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type { AuthAccountIdentity, AuthAccountSecurityState } from '@/entities/AuthAccount';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import type {
  CreatePendingAccountData,
  IAuthAccountRepository,
} from '@/interfaces/repositories/IAuthAccountRepository';
import { AuthAccountPersistenceMapper } from '@/repositories/mappers/AuthAccountPersistenceMapper';
import type { AuthAccountPersistenceRecord } from '@/repositories/types/AuthAccountPersistence';

const SECURITY_FIELDS =
  'email role password emailVerified emailVerificationTokenHash ' +
  'emailVerificationExpires passwordResetTokenHash passwordResetExpires';

export class AuthAccountRepository implements IAuthAccountRepository {
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
}
