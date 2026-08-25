import { Types } from 'mongoose';
import type { CurrentEntitlement } from '@/entities/Entitlement';
import type { IEntitlementRepository } from '@/interfaces/repositories/IEntitlementRepository';
import connectDB from '@/lib/mongoose';
import { EntitlementAccount } from '@/models/Billing';
import User from '@/models/User';
import { ACTIVE_ACCOUNT_FILTER } from '@/shared/constants/account-disable';

interface EntitlementAccountLean {
  user: Types.ObjectId;
  planId?: string;
  planName?: string;
  currentStartAt?: Date;
  currentEndAt?: Date;
  perpetual: boolean;
}

export class EntitlementRepository implements IEntitlementRepository {
  async findCurrentByUserId(userId: string, now = new Date()): Promise<CurrentEntitlement | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await connectDB();
    const userObjectId = new Types.ObjectId(userId);
    const [account, activeUser] = await Promise.all([
      EntitlementAccount.findOne({ user: userObjectId }).lean<EntitlementAccountLean>().exec(),
      User.exists({ _id: userObjectId, ...ACTIVE_ACCOUNT_FILTER }),
    ]);
    if (
      !account ||
      !activeUser ||
      !account.planId ||
      !account.planName ||
      !account.currentStartAt
    ) {
      return null;
    }

    const started = account.currentStartAt.getTime() <= now.getTime();
    const isActive =
      started &&
      (account.perpetual === true ||
        (account.currentEndAt !== undefined && account.currentEndAt.getTime() > now.getTime()));

    return {
      userId,
      planId: account.planId,
      planName: account.planName,
      startDate: account.currentStartAt,
      ...(account.currentEndAt === undefined ? {} : { endDate: account.currentEndAt }),
      perpetual: account.perpetual,
      isActive,
    };
  }
}
