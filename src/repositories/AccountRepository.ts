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

const PROFILE_FIELDS = 'email displayName bio avatar role createdAt subscription';

export class AccountRepository implements IAccountRepository {
  async findProfileByEmail(email: string): Promise<AccountProfile | null> {
    await connectDB();
    const record = await User.findOne({ email })
      .select(PROFILE_FIELDS)
      .lean<AccountProfilePersistenceRecord>();
    return record ? AccountPersistenceMapper.toProfile(record) : null;
  }

  async updateProfileByEmail(
    email: string,
    update: AccountProfileUpdate,
  ): Promise<AccountProfile | null> {
    await connectDB();
    const record = await User.findOneAndUpdate({ email }, { $set: update }, { new: true })
      .select(PROFILE_FIELDS)
      .lean<AccountProfilePersistenceRecord>();
    return record ? AccountPersistenceMapper.toProfile(record) : null;
  }

  async findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    await connectDB();
    const record = await User.findOne({ email })
      .select('password')
      .lean<AccountCredentialsPersistenceRecord>();
    return record ? AccountPersistenceMapper.toCredentials(record) : null;
  }

  async updatePasswordHash(email: string, passwordHash: string): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne({ email }, { $set: { password: passwordHash } });
    return result.matchedCount === 1;
  }

  async updateAvatar(email: string, avatarUrl: string): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne({ email }, { $set: { avatar: avatarUrl } });
    return result.matchedCount === 1;
  }

  async clearAvatar(email: string): Promise<boolean> {
    await connectDB();
    const result = await User.updateOne({ email }, { $unset: { avatar: 1 } });
    return result.matchedCount === 1;
  }
}
