import { randomUUID } from 'node:crypto';
import mongoose, { Types, type PipelineStage } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import User from '@/models/User';
import { EntitlementAccount, EntitlementGrant } from '@/models/Billing';
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
  IAdminSubscriptionRepository,
  UpdateBillingPlanData,
} from '@/interfaces/repositories/IAdminSubscriptionRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { buildPaginationMeta } from '@/lib/pagination';
import { findBillingPlanById } from '@/repositories/helpers/findBillingPlanById';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';
import type {
  AdminSubscriptionPersistenceRecord,
  BillingPlanPersistenceRecord,
} from '@/repositories/types/AdminBillingPersistence';
import { EntitlementLedgerRepository } from '@/repositories/EntitlementLedgerRepository';

interface AdminEntitlementFacetMeta {
  totalItems: number;
}

interface AdminEntitlementFacet {
  items: AdminSubscriptionPersistenceRecord[];
  meta: AdminEntitlementFacetMeta[];
}

export class AdminSubscriptionRepository implements IAdminSubscriptionRepository {
  private readonly entitlementLedger = new EntitlementLedgerRepository();

  async listPlans(): Promise<BillingPlan[]> {
    await connectDB();
    const plans = await Plan.find().lean<BillingPlanPersistenceRecord[]>();
    return plans.map((plan) => AdminBillingPersistenceMapper.toPlan(plan));
  }

  async findPlanById(planId: string): Promise<BillingPlan | null> {
    return findBillingPlanById(planId);
  }

  async createPlan(data: CreateBillingPlanData): Promise<BillingPlan> {
    await connectDB();
    try {
      const saved = await Plan.create({
        _id: data.id,
        name: data.name,
        price: data.price,
        duration: data.duration,
        isActive: data.isActive,
      });

      return AdminBillingPersistenceMapper.toPlan({
        _id: String(saved._id),
        name: saved.name,
        price: saved.price,
        duration: saved.duration,
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

        const entitlementExists = await EntitlementGrant.exists({ planId }).session(session);
        if (entitlementExists) {
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
    const search = options.search?.trim();
    const skip = (options.page - 1) * options.limit;
    const match: Record<string, unknown> = {};
    if (options.status) match['status'] = options.status;
    if (search) {
      const searchPattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match['$or'] = [{ userEmail: searchPattern }, { payosOrderId: searchPattern }];
    }

    const pipeline: PipelineStage[] = [
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDoc' } },
      { $set: { userDoc: { $first: '$userDoc' } } },
      {
        $lookup: {
          from: 'entitlementgrants',
          let: { userId: '$user' },
          pipeline: [
            { $match: { $expr: { $eq: ['$user', '$$userId'] } } },
            { $sort: { sequence: -1 } },
            { $limit: 1 },
          ],
          as: 'latestGrant',
        },
      },
      { $set: { latestGrant: { $first: '$latestGrant' } } },
      {
        $set: {
          sourceOrderId: {
            $cond: [
              { $eq: ['$latestGrant.sourceType', 'billing_order'] },
              { $convert: { input: '$latestGrant.sourceId', to: 'objectId', onError: null } },
              null,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'billingorders',
          localField: 'sourceOrderId',
          foreignField: '_id',
          as: 'orderDoc',
        },
      },
      { $set: { orderDoc: { $first: '$orderDoc' } } },
      { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'planDoc' } },
      { $set: { planDoc: { $first: '$planDoc' } } },
      {
        $lookup: {
          from: 'paymenttransactions',
          let: { orderId: '$sourceOrderId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$order', '$$orderId'] } } },
            { $sort: { providerEventAt: -1 } },
            { $limit: 1 },
          ],
          as: 'transactionDoc',
        },
      },
      { $set: { transactionDoc: { $first: '$transactionDoc' } } },
      {
        $set: {
          userEmail: '$userDoc.email',
          amount: { $ifNull: ['$orderDoc.finalAmount', { $ifNull: ['$planDoc.price', 0] }] },
          currency: 'VND',
          payosOrderId: {
            $ifNull: [{ $toString: '$orderDoc.orderCode' }, '$latestGrant.sourceId'],
          },
          payosTransactionId: '$transactionDoc.externalReference',
          startDate: '$currentStartAt',
          endDate: '$currentEndAt',
          isActive: {
            $and: [
              { $lte: ['$currentStartAt', '$$NOW'] },
              {
                $or: [{ $eq: ['$perpetual', true] }, { $gt: ['$currentEndAt', '$$NOW'] }],
              },
            ],
          },
          status: {
            $cond: [
              {
                $and: [
                  { $lte: ['$currentStartAt', '$$NOW'] },
                  {
                    $or: [{ $eq: ['$perpetual', true] }, { $gt: ['$currentEndAt', '$$NOW'] }],
                  },
                ],
              },
              'completed',
              'expired',
            ],
          },
        },
      },
      ...(Object.keys(match).length === 0 ? [] : [{ $match: match } as PipelineStage.Match]),
      { $sort: { updatedAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: options.limit },
            {
              $project: {
                _id: 1,
                user: 1,
                userEmail: 1,
                planId: 1,
                planName: 1,
                amount: 1,
                currency: 1,
                status: 1,
                payosOrderId: 1,
                payosTransactionId: 1,
                startDate: 1,
                endDate: 1,
                isActive: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ];
    const [result] = await EntitlementAccount.aggregate<AdminEntitlementFacet>(pipeline);
    const subscriptions = result?.items ?? [];
    const totalItems = result?.meta[0]?.totalItems ?? 0;

    return {
      items: subscriptions.map((subscription) =>
        AdminBillingPersistenceMapper.toSubscription(subscription),
      ),
      pagination: buildPaginationMeta(options.page, options.limit, totalItems),
    };
  }

  async findUserById(userId: string): Promise<AdminBillingUserIdentity | null> {
    await connectDB();
    // Active accounts only — disabled users cannot receive admin grants.
    const user = await User.findOne({ _id: userId, disable: 0 }).select('email').lean<{
      _id: Types.ObjectId;
      email: string;
    }>();
    return user ? { id: String(user._id), email: user.email } : null;
  }

  async addUserSubscriptionGrant(input: CreateAdminSubscriptionGrantData): Promise<void> {
    await connectDB();
    const grantId = randomUUID();
    const sourceId = `admin_${grantId}`;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const plan = await Plan.findOne({ _id: input.planId, isActive: true })
          .select('duration')
          .session(session)
          .lean<{ duration: string }>();
        if (!plan) throw new BillingPlanUnavailableError();
        const duration = /^P(\d+)M$/.exec(plan.duration);
        if (!duration?.[1]) throw new BillingPlanUnavailableError();

        // Final atomic boundary: only active accounts (disable: 0) may receive grants.
        const user = await User.findOne({ _id: input.userId, disable: 0 })
          .select('_id')
          .session(session)
          .lean<{ _id: Types.ObjectId }>();
        if (!user) throw new AdminBillingUserNotFoundError();

        await this.entitlementLedger.appendGrant(
          {
            user: user._id,
            sourceType: 'manual',
            sourceId,
            planId: input.planId,
            planName: input.planName,
            durationUnit: 'month',
            durationValue: Number(duration[1]),
            committedAt: input.startDate,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }
}
