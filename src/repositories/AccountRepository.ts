import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type { AccountCredentials, AccountProfile } from '@/entities/Account';
import type {
  AccountProfileUpdate,
  IAccountRepository,
} from '@/interfaces/repositories/IAccountRepository';
import { AccountPersistenceMapper } from '@/repositories/mappers/AccountPersistenceMapper';
import type {
  AccountCredentialsPersistenceRecord,
  AccountProfilePersistenceRecord,
} from '@/repositories/types/AccountPersistence';
import { ACTIVE_ACCOUNT_FILTER } from '@/shared/constants/account-disable';

const PROFILE_FIELDS = 'email displayName bio avatar role createdAt subscription';

export class AccountRepository implements IAccountRepository {
  async findProfileByEmail(email: string): Promise<AccountProfile | null> {
    await connectDB();
    const record = await User.findOne({ email, ...ACTIVE_ACCOUNT_FILTER })
      .select(PROFILE_FIELDS)
      .lean<AccountProfilePersistenceRecord>();
    return record ? AccountPersistenceMapper.toProfile(record) : null;
  }

  async updateProfileByEmail(
    email: string,
    update: AccountProfileUpdate,
  ): Promise<AccountProfile | null> {
    await connectDB();
    const record = await User.findOneAndUpdate(
      { email, ...ACTIVE_ACCOUNT_FILTER },
      { $set: update },
      { new: true },
    )
      .select(PROFILE_FIELDS)
      .lean<AccountProfilePersistenceRecord>();
    return record ? AccountPersistenceMapper.toProfile(record) : null;
  }

  async findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    await connectDB();
    const record = await User.findOne({ email, ...ACTIVE_ACCOUNT_FILTER })
      .select('password')
      .lean<AccountCredentialsPersistenceRecord>();
    return record ? AccountPersistenceMapper.toCredentials(record) : null;
  }

  async updatePasswordHash(email: string, passwordHash: string): Promise<boolean> {
    await connectDB();
    // updateOne bypasses User pre-save middleware, so passwordChangedAt must be
    // written in the same Mongo update as password for JWT session revocation (token.pwc).
    // Final write also requires exact disable:0 so a mid-flight disable fails closed.
    const passwordChangedAt = new Date();
    const result = await User.updateOne(
      { email, ...ACTIVE_ACCOUNT_FILTER },
      { $set: { password: passwordHash, passwordChangedAt } },
    );
    return result.matchedCount === 1;
  }

  async updateAvatar(email: string, avatarUrl: string): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      { email, ...ACTIVE_ACCOUNT_FILTER },
      { $set: { avatar: avatarUrl } },
    );
    return result.matchedCount === 1;
  }

  async clearAvatar(email: string): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne(
      { email, ...ACTIVE_ACCOUNT_FILTER },
      { $unset: { avatar: 1 } },
    );
    return result.matchedCount === 1;
  }
}
