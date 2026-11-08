import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import type {
  IUserTestAccountRepository,
  TestAccountFlagWrite,
} from '@/interfaces/repositories/IUserTestAccountRepository';

interface TestAccountFlagRecord {
  isTestAccount?: boolean;
}

export class UserTestAccountRepository implements IUserTestAccountRepository {
  async setTestAccount(
    userId: string,
    isTestAccount: boolean,
  ): Promise<TestAccountFlagWrite | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await connectDB();
    // `new: false` returns the document as it was, so the previous value comes
    // from the same atomic write.
    const before = await User.findOneAndUpdate(
      { _id: new Types.ObjectId(userId) },
      { $set: { isTestAccount } },
      { new: false, projection: { isTestAccount: 1 } },
    )
      .lean<TestAccountFlagRecord>()
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
