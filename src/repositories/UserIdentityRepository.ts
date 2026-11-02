import type { Types } from 'mongoose';
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

/** An unanchored regex cannot use an index; bound the scan instead of letting it run. */
const SEARCH_MAX_TIME_MS = 2000;

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
  async findByNameOrEmail(search: string, limit: number): Promise<UserIdentity[]> {
    const term = search.trim();
    if (!term) return [];

    await connectDB();
    const pattern = { $regex: escapeRegexLiteral(term), $options: 'i' };
    // Sorted so the same search always truncates to the same accounts.
    const records = await User.find({
      $or: [{ email: pattern }, { name: pattern }, { displayName: pattern }],
    })
      .select('email name displayName')
      .sort({ _id: 1 })
      .limit(limit)
      .maxTimeMS(SEARCH_MAX_TIME_MS)
      .lean<UserIdentityRecord[]>();
    return records.map(toUserIdentity);
  }
}
