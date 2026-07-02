import { randomUUID } from 'node:crypto';
import mongoose, { type FilterQuery, Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import {
  AdminBillingUserNotFoundError,
  BillingPlanConflictError,
  BillingPlanInUseError,
  BillingPlanUnavailableError,
  type AdminSubscriptionRecord,
  type BillingPlan,
} from '@/entities/AdminBilling';
import type {
  AdminSubscriptionListOptions,
  AdminBillingUserIdentity,
  CreateAdminSubscriptionGrantData,
  CreateBillingPlanData,
  IAdminBillingRepository,
  UpdateBillingPlanData,
} from '@/interfaces/repositories/IAdminBillingRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { buildPaginationMeta } from '@/lib/pagination';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';
import type {
  AdminSubscriptionPersistenceRecord,
  BillingPlanPersistenceRecord,
} from '@/repositories/types/AdminBillingPersistence';

export class AdminBillingRepository implements IAdminBillingRepository {
  async listPlans(): Promise<BillingPlan[]> {
    await connectDB();
    const plans = await Plan.find().lean<BillingPlanPersistenceRecord[]>();
    return plans.map((plan) => AdminBillingPersistenceMapper.toPlan(plan));
  }

  async findPlanById(planId: string): Promise<BillingPlan | null> {
    await connectDB();
    const plan = await Plan.findById(planId).lean<BillingPlanPersistenceRecord>();
    return plan ? AdminBillingPersistenceMapper.toPlan(plan) : null;
  }

  async createPlan(data: CreateBillingPlanData): Promise<BillingPlan> {
    await connectDB();
    try {
      const saved = await Plan.create({
        _id: data.id,
        name: data.name,
        price: data.price,
        duration: data.duration,
        features: data.features,
        isActive: data.isActive,
      });

      return AdminBillingPersistenceMapper.toPlan({
        _id: String(saved._id),
        name: saved.name,
        price: saved.price,
        duration: saved.duration,
        features: saved.features,
        isActive: saved.isActive,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) throw new BillingPlanConflictError();
      throw error;
    }
  }

  async updatePlan(planId: string, data: UpdateBillingPlanData): Promise<BillingPlan | null> {
    await connectDB();
    const updated = await Plan.findByIdAndUpdate(planId, data, {
      new: true,
      upsert: false,
      runValidators: true,
    }).lean<BillingPlanPersistenceRecord>();

    return updated ? AdminBillingPersistenceMapper.toPlan(updated) : null;
  }

  async deletePlan(planId: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    let deleted = false;

    try {
      await session.withTransaction(async () => {
        const plan = await Plan.findById(planId)
          .select('_id')
          .session(session)
          .lean<{ _id: string }>();
        if (!plan) return;

        const [subscriptionExists, assignedUserExists] = await Promise.all([
          Subscription.exists({ type: planId }).session(session),
          User.exists({ 'subscription.type': planId }).session(session),
        ]);
        if (subscriptionExists || assignedUserExists) {
          throw new BillingPlanInUseError();
        }

        const result = await Plan.deleteOne({ _id: planId }).session(session);
        deleted = result.deletedCount === 1;
      });
    } finally {
      await session.endSession();
    }

    return deleted;
  }

  async listSubscriptions(
    options: AdminSubscriptionListOptions,
  ): Promise<PaginatedRepositoryResult<AdminSubscriptionRecord>> {
    await connectDB();
    const filter: FilterQuery<AdminSubscriptionPersistenceRecord> = {};
    if (options.status) filter.status = options.status;

    const search = options.search?.trim();
    if (search) {
      const searchPattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ userEmail: searchPattern }, { payosOrderId: searchPattern }];
    }

    const skip = (options.page - 1) * options.limit;
    const [subscriptions, totalItems] = await Promise.all([
      Subscription.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean<AdminSubscriptionPersistenceRecord[]>(),
      Subscription.countDocuments(filter),
    ]);

    return {
      items: subscriptions.map((subscription) =>
        AdminBillingPersistenceMapper.toSubscription(subscription),
      ),
      pagination: buildPaginationMeta(options.page, options.limit, totalItems),
    };
  }

  async findUserById(userId: string): Promise<AdminBillingUserIdentity | null> {
    await connectDB();
    const user = await User.findById(userId).select('email').lean<{
      _id: Types.ObjectId;
      email: string;
    }>();
    return user ? { id: String(user._id), email: user.email } : null;
  }

  async addUserSubscriptionGrant(input: CreateAdminSubscriptionGrantData): Promise<void> {
    await connectDB();
    const grantId = randomUUID();
    const orderId = `admin_${grantId}`;
    const transactionId = `admin_${grantId}`;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const plan = await Plan.exists({ _id: input.planId, isActive: true }).session(session);
        if (!plan) throw new BillingPlanUnavailableError();

        const user = await User.findByIdAndUpdate(
          input.userId,
          {
            subscription: {
              type: input.planId,
              startDate: input.startDate,
              endDate: input.endDate,
              isActive: true,
              payosOrderId: orderId,
              payosTransactionId: transactionId,
            },
          },
          { session },
        )
          .select('_id')
          .lean<{ _id: Types.ObjectId }>();
        if (!user) throw new AdminBillingUserNotFoundError();

        await Subscription.create(
          [
            {
              user: new Types.ObjectId(input.userId),
              userEmail: input.userEmail,
              type: input.planId,
              amount: input.amount,
              currency: 'VND',
              status: 'completed',
              payosOrderId: orderId,
              payosTransactionId: transactionId,
              startDate: input.startDate,
              endDate: input.endDate,
              isActive: true,
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
