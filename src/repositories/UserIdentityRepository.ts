import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type {
  IUserIdentityRepository,
  UserIdentity,
} from '@/interfaces/repositories/IUserIdentityRepository';

interface UserIdentityRecord {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  displayName?: string;
}

/** Escape user-provided search so Mongo `$regex` treats it as a literal. */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUserIdentity(record: UserIdentityRecord): UserIdentity {
  const label = record.displayName?.trim() || record.name?.trim();
  return {
    id: record._id.toString(),
    email: record.email,
    ...(label ? { displayName: label } : {}),
  };
}

export class UserIdentityRepository implements IUserIdentityRepository {
  async findIdentitiesByIds(ids: readonly string[]): Promise<UserIdentity[]> {
    const objectIds = [...new Set(ids)]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) return [];

    await connectDB();
    const records = await User.find({ _id: { $in: objectIds } })
      .select('email name displayName')
      .lean<UserIdentityRecord[]>();
    return records.map(toUserIdentity);
  }

  async findIdsByNameOrEmail(search: string, limit: number): Promise<string[]> {
    const term = search.trim();
    if (!term) return [];

    await connectDB();
    const pattern = { $regex: escapeRegexLiteral(term), $options: 'i' };
    const records = await User.find({
      $or: [{ email: pattern }, { name: pattern }, { displayName: pattern }],
    })
      .select('_id')
      .limit(limit)
      .lean<{ _id: Types.ObjectId }[]>();
    return records.map((record) => record._id.toString());
  }
}
