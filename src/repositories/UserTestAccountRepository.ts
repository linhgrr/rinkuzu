import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type { IUserTestAccountRepository } from '@/interfaces/repositories/IUserTestAccountRepository';

export class UserTestAccountRepository implements IUserTestAccountRepository {
  async setTestAccount(
    userId: string,
    isTestAccount: boolean,
  ): Promise<{ previous: boolean } | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await connectDB();
    // `new: false` returns the document as it was, so the previous value comes
    // from the same atomic write.
    const before = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: { isTestAccount } },
      { new: false, projection: { isTestAccount: 1 } },
    )
      .lean<{ isTestAccount?: boolean }>()
      .exec();
    return before ? { previous: before.isTestAccount === true } : null;
  }

  async revertTestAccount(userId: string, current: boolean, previous: boolean): Promise<void> {
    await connectDB();
    await User.updateOne(
      { _id: new Types.ObjectId(userId), isTestAccount: current },
      { $set: { isTestAccount: previous } },
    ).exec();
  }
}
