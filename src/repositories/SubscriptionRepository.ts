import connectDB from '@/lib/mongoose';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import {
  type AdminSubscriptionStatusUpdateResult,
  type ActivateSubscriptionData,
  type CancelCurrentSubscriptionResult,
  type CreateSubscriptionData,
  type ExpireDueResult,
  ISubscriptionRepository,
  type UpdateSubscriptionData,
} from '@/interfaces/repositories/ISubscriptionRepository';
import {
  isAdminSubscriptionStatusTransitionAllowed,
  SubscriptionActivationConflictError,
  type SubscriptionRecord,
} from '@/entities/Subscription';
import type { AdminMutableSubscriptionStatus } from '@/shared/constants/subscription-status';
import mongoose from 'mongoose';
import { SubscriptionPersistenceMapper } from '@/repositories/mappers/SubscriptionPersistenceMapper';
import { matchIndexedString } from '@/repositories/filters/indexed-string';
import type {
  CurrentUserSubscriptionPersistenceRecord,
  ExpiredSubscriptionCandidatePersistenceRecord,
  SubscriptionPersistenceRecord,
} from '@/repositories/types/SubscriptionPersistence';

export class SubscriptionRepository implements ISubscriptionRepository {
  async create(subscriptionData: CreateSubscriptionData): Promise<SubscriptionRecord> {
    await connectDB();
    const document = await Subscription.create({
      user: subscriptionData.userId,
      userEmail: subscriptionData.userEmail,
      type: subscriptionData.type,
      amount: subscriptionData.amount,
      currency: subscriptionData.currency,
      status: subscriptionData.status,
      payosOrderId: subscriptionData.payosOrderId,
    });
    const record: SubscriptionPersistenceRecord = document.toObject();
    return SubscriptionPersistenceMapper.toEntity(record);
  }

  async findById(id: string): Promise<SubscriptionRecord | null> {
    await connectDB();
    const record = await Subscription.findById(id).lean<SubscriptionPersistenceRecord>();
    return record ? SubscriptionPersistenceMapper.toEntity(record) : null;
  }

  async findByOrderId(orderId: string): Promise<SubscriptionRecord | null> {
    await connectDB();
    const record = await Subscription.findOne({
      payosOrderId: orderId,
    }).lean<SubscriptionPersistenceRecord>();
    return record ? SubscriptionPersistenceMapper.toEntity(record) : null;
  }

  async findByTransactionReference(
    transactionReference: string,
  ): Promise<SubscriptionRecord | null> {
    await connectDB();
    const record = await Subscription.findOne({
      payosTransactionId: matchIndexedString(transactionReference),
    }).lean<SubscriptionPersistenceRecord>();
    return record ? SubscriptionPersistenceMapper.toEntity(record) : null;
  }

  async expireDue(now: Date): Promise<ExpireDueResult> {
    await connectDB();
    const session = await mongoose.startSession();
    let result: ExpireDueResult = { count: 0, userIds: [] };

    try {
      await session.withTransaction(async () => {
        // Sequential on purpose: withTransaction forbids Promise.all (architecture check).
        const subscriptions = await Subscription.find({
          isActive: true,
          endDate: { $exists: true, $lte: now },
          status: 'completed',
        })
          .select('_id user payosOrderId')
          .session(session)
          .lean<ExpiredSubscriptionCandidatePersistenceRecord[]>();
        const users = await User.find({
          'subscription.isActive': true,
          'subscription.endDate': { $exists: true, $lte: now },
        })
          .select('_id subscription')
          .session(session)
          .lean<CurrentUserSubscriptionPersistenceRecord[]>();

        // Candidate identifiers only — never re-open the date predicate on update.
        const subscriptionIds = subscriptions.map((subscription) => subscription._id);
        const orderIds = users
          .map((user) => user.subscription?.payosOrderId)
          .filter((orderId): orderId is string => orderId !== undefined);
        const userIdByKey = new Map(
          [
            ...subscriptions.map((subscription) => subscription.user),
            ...users.map((user) => user._id),
          ].map((userId) => [String(userId), userId]),
        );

        if (subscriptionIds.length === 0 && userIdByKey.size === 0) {
          return;
        }

        // Constrain mutations to the projected candidate set:
        // - subscription docs by captured _id
        // - plus subscription docs whose payosOrderId was captured from a due user row
        //   (embedded/user lag; orderIds never come from a live re-query)
        if (subscriptionIds.length > 0 || orderIds.length > 0) {
          await Subscription.updateMany(
            {
              $or: [
                ...(subscriptionIds.length > 0 ? [{ _id: { $in: subscriptionIds } }] : []),
                ...(orderIds.length > 0 ? [{ payosOrderId: { $in: orderIds } }] : []),
              ],
              status: 'completed',
              isActive: true,
            },
            { $set: { status: 'expired', isActive: false } },
          ).session(session);
        }

        if (userIdByKey.size > 0) {
          await User.updateMany(
            {
              _id: { $in: [...userIdByKey.values()] },
              'subscription.isActive': true,
            },
            { $set: { 'subscription.isActive': false } },
          ).session(session);
        }

        const userIds = [...userIdByKey.keys()];
        result = { count: userIds.length, userIds };
      });
    } finally {
      await session.endSession();
    }

    return result;
  }

  async updateById(
    id: string,
    updateData: UpdateSubscriptionData,
  ): Promise<SubscriptionRecord | null> {
    await connectDB();
    const record = await Subscription.findByIdAndUpdate(id, updateData, {
      new: true,
    }).lean<SubscriptionPersistenceRecord>();
    return record ? SubscriptionPersistenceMapper.toEntity(record) : null;
  }

  async updateByOrderId(
    orderId: string,
    updateData: UpdateSubscriptionData,
  ): Promise<SubscriptionRecord | null> {
    await connectDB();
    const record = await Subscription.findOneAndUpdate({ payosOrderId: orderId }, updateData, {
      new: true,
    }).lean<SubscriptionPersistenceRecord>();
    return record ? SubscriptionPersistenceMapper.toEntity(record) : null;
  }

  async updateAdminStatusById(
    id: string,
    status: AdminMutableSubscriptionStatus,
  ): Promise<AdminSubscriptionStatusUpdateResult> {
    await connectDB();
    const session = await mongoose.startSession();
    let outcome: AdminSubscriptionStatusUpdateResult = { outcome: 'not_found' };

    try {
      await session.withTransaction(async () => {
        const subscription = await Subscription.findById(id).session(session);
        if (!subscription) return;

        const cannotExpireLifetimeSubscription =
          status === 'expired' && subscription.endDate === undefined;
        if (
          cannotExpireLifetimeSubscription ||
          !isAdminSubscriptionStatusTransitionAllowed(subscription.status, status)
        ) {
          outcome = {
            outcome: 'invalid_transition',
            currentStatus: subscription.status,
          };
          return;
        }

        subscription.status = status;
        subscription.isActive = false;
        const saved = await subscription.save({ session });

        await User.updateOne(
          {
            _id: subscription.user,
            'subscription.payosOrderId': subscription.payosOrderId,
          },
          { $set: { 'subscription.isActive': false } },
          { session },
        );

        const record: SubscriptionPersistenceRecord = saved.toObject();
        outcome = {
          outcome: 'updated',
          subscription: SubscriptionPersistenceMapper.toEntity(record),
        };
      });
    } finally {
      await session.endSession();
    }

    return outcome;
  }

  async expireCurrentForUser(userId: string, orderId: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    let expired = false;

    try {
      await session.withTransaction(async () => {
        const subscriptionResult = await Subscription.updateOne(
          {
            user: userId,
            payosOrderId: orderId,
            status: 'completed',
            isActive: true,
          },
          { $set: { status: 'expired', isActive: false } },
          { session },
        );
        if (subscriptionResult.matchedCount !== 1) return;

        const userResult = await User.updateOne(
          {
            _id: userId,
            'subscription.payosOrderId': orderId,
            'subscription.isActive': true,
          },
          { $set: { 'subscription.isActive': false } },
          { session },
        );
        if (userResult.matchedCount !== 1) {
          throw new Error('Current user subscription changed during expiry');
        }

        expired = true;
      });
    } finally {
      await session.endSession();
    }

    return expired;
  }

  async cancelCurrentForUser(userId: string): Promise<CancelCurrentSubscriptionResult> {
    await connectDB();
    const session = await mongoose.startSession();
    let outcome: CancelCurrentSubscriptionResult = { outcome: 'user_not_found' };

    try {
      await session.withTransaction(async () => {
        const user = await User.findById(userId)
          .select('_id subscription')
          .session(session)
          .lean<CurrentUserSubscriptionPersistenceRecord>();
        if (!user) return;
        if (!user.subscription?.endDate) {
          outcome = { outcome: 'not_time_limited' };
          return;
        }
        if (!user.subscription.isActive) {
          outcome = { outcome: 'already_inactive' };
          return;
        }
        if (!user.subscription.payosOrderId) {
          outcome = { outcome: 'inconsistent_record' };
          return;
        }

        const subscriptionResult = await Subscription.updateOne(
          {
            user: user._id,
            payosOrderId: user.subscription.payosOrderId,
            status: 'completed',
            isActive: true,
          },
          {
            $set: {
              status: 'cancelled',
              isActive: false,
            },
          },
          { session },
        );
        if (subscriptionResult.matchedCount !== 1) {
          outcome = { outcome: 'inconsistent_record' };
          return;
        }

        const userResult = await User.updateOne(
          {
            _id: user._id,
            'subscription.payosOrderId': user.subscription.payosOrderId,
            'subscription.isActive': true,
          },
          { $set: { 'subscription.isActive': false } },
          { session },
        );
        if (userResult.matchedCount !== 1) {
          throw new Error('Current user subscription changed during cancellation');
        }

        outcome = { outcome: 'cancelled' };
      });
    } finally {
      await session.endSession();
    }

    return outcome;
  }

  async activateSubscription(data: ActivateSubscriptionData): Promise<void> {
    await connectDB();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const subscriptionResult = await Subscription.updateOne(
          {
            payosOrderId: data.orderId,
            user: data.userId,
            status: 'pending',
          },
          {
            $set: {
              status: 'completed',
              ...(data.transactionReference !== undefined && {
                payosTransactionId: data.transactionReference,
              }),
              startDate: data.startDate,
              ...(data.endDate !== undefined && { endDate: data.endDate }),
              isActive: true,
            },
          },
          { session },
        );
        if (subscriptionResult.matchedCount !== 1) {
          throw new SubscriptionActivationConflictError(
            'Pending subscription changed before activation',
          );
        }

        // Final atomic boundary: only active accounts (disable: 0) may be activated.
        const userResult = await User.updateOne(
          { _id: data.userId, disable: 0 },
          {
            $set: {
              subscription: {
                type: data.type,
                startDate: data.startDate,
                ...(data.endDate !== undefined && { endDate: data.endDate }),
                isActive: true,
                payosOrderId: data.orderId,
                ...(data.transactionReference !== undefined && {
                  payosTransactionId: data.transactionReference,
                }),
              },
            },
          },
          { session },
        );
        if (userResult.matchedCount !== 1) {
          throw new SubscriptionActivationConflictError(
            'Subscription user changed before activation',
          );
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
