import connectDB from '@/lib/mongoose';
import Subscription, { ISubscription } from '@/models/Subscription';
import { buildPaginationMeta } from '@/repositories/pagination';
import { BaseRepository } from '@/repositories/base';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import mongoose, { type FilterQuery } from 'mongoose';

export class SubscriptionRepository
  extends BaseRepository<ISubscription>
  implements ISubscriptionRepository
{
  constructor() {
    super(Subscription);
  }

  async findByOrderId(orderId: string): Promise<ISubscription | null> {
    await connectDB();
    return (await Subscription.findOne({
      payosOrderId: orderId,
    }).lean()) as unknown as ISubscription | null;
  }

  async findByUser(userId: string): Promise<ISubscription[]> {
    await connectDB();
    // If userId is not provided, return all subscriptions (used by admin list)
    if (!userId) {
      return (await Subscription.find({})
        .sort({ createdAt: -1 })
        .lean()) as unknown as ISubscription[];
    }

    // Guard against invalid ObjectId to avoid CastError
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return [];
    }

    return (await Subscription.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean()) as unknown as ISubscription[];
  }

  async findExpiredSubscriptions(): Promise<ISubscription[]> {
    await connectDB();
    const now = new Date();
    return (await Subscription.find({
      isActive: true,
      endDate: { $exists: true, $lte: now },
      status: 'completed',
    }).lean()) as unknown as ISubscription[];
  }

  async updateById(id: string, updateData: Partial<ISubscription>): Promise<ISubscription | null> {
    await connectDB();
    return (await Subscription.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean()) as unknown as ISubscription | null;
  }

  async updateByOrderId(
    orderId: string,
    updateData: Partial<ISubscription>,
  ): Promise<ISubscription | null> {
    await connectDB();
    return (await Subscription.findOneAndUpdate({ payosOrderId: orderId }, updateData, {
      new: true,
    }).lean()) as unknown as ISubscription | null;
  }

  async deleteById(id: string): Promise<boolean> {
    await connectDB();
    const result = await Subscription.findByIdAndDelete(id);
    return !!result;
  }

  async deleteByOrderId(orderId: string): Promise<boolean> {
    await connectDB();
    const result = await Subscription.findOneAndDelete({ payosOrderId: orderId });
    return !!result;
  }

  async findWithPagination(
    filter: FilterQuery<ISubscription>,
    page: number,
    limit: number,
  ): Promise<{
    subscriptions: ISubscription[];
    pagination: import('@/types').PaginationMeta;
  }> {
    await connectDB();

    const total = await Subscription.countDocuments(filter);
    const subscriptions = (await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'email role')
      .lean()) as unknown as ISubscription[];

    return {
      subscriptions,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}
