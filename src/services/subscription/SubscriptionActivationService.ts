import mongoose from 'mongoose';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import { SubscriptionActivation } from '@/interfaces/services/ISubscriptionService';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { DurationUtils } from '@/types/subscription';
import type { ISubscription } from '@/models/Subscription';

interface UserSubscriptionEmbed {
  endDate?: Date | string | null;
  isActive?: boolean;
}

interface UserWithSubscription {
  subscription?: UserSubscriptionEmbed;
}

interface SubscriptionWithId extends ISubscription {
  _id: { toString(): string };
}

/**
 * Idempotent activation guard. The webhook can fire multiple times for the
 * same PayOS transaction (PayOS retries on non-2xx, network blips, manual
 * replays). We rely on the unique sparse index on `payosTransactionId` plus
 * an explicit pre-check so duplicate webhook deliveries don't extend the
 * end date or grant a second billing cycle.
 */
async function findExistingActivation(
  transactionReference: string | undefined,
): Promise<ISubscription | null> {
  if (!transactionReference) return null;
  return Subscription.findOne({ payosTransactionId: transactionReference }).lean<ISubscription>();
}

export class SubscriptionActivationService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
  ) {}

  async verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivation> {
    await connectDB();

    // Get subscription record
    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.user.toString() !== userId) {
      throw new Error('Subscription does not belong to current user');
    }

    if (subscription.status === 'completed') {
      if (subscription.endDate && new Date(subscription.endDate) <= new Date()) {
        throw new Error('Subscription already expired');
      }

      return {
        success: true,
        subscription: {
          type: subscription.type,
          startDate: subscription.startDate || subscription.createdAt,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
        },
      };
    }

    if (subscription.status !== 'pending') {
      throw new Error(`Cannot verify subscription with status ${subscription.status}`);
    }

    // Verify payment with PayOS
    const paymentInfo = await this.payosService.verifyPayment(orderCode);

    if (paymentInfo.code !== '00') {
      throw new Error(paymentInfo.desc || 'Failed to verify payment');
    }

    // Check if payment is successful (status PAID)
    if (paymentInfo.data?.status !== 'PAID') {
      throw new Error('Payment not completed');
    }

    if (String(paymentInfo.data?.orderCode) !== orderCode.toString()) {
      throw new Error('Payment order code mismatch');
    }

    if (Number(paymentInfo.data?.amount) !== subscription.amount) {
      throw new Error('Payment amount mismatch');
    }

    return this.activateSubscription(subscription, orderCode, paymentInfo.data?.reference);
  }

  async activateVerifiedSubscription(
    orderCode: number,
    paymentData: {
      orderCode: string | number;
      amount: string | number;
      reference?: string;
      status?: string;
      code?: string;
    },
  ): Promise<SubscriptionActivation> {
    await connectDB();

    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === 'completed') {
      return {
        success: true,
        subscription: {
          type: subscription.type,
          startDate: subscription.startDate || subscription.createdAt,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
        },
      };
    }

    if (subscription.status !== 'pending') {
      throw new Error(`Cannot activate subscription with status ${subscription.status}`);
    }

    if (String(paymentData.orderCode) !== orderCode.toString()) {
      throw new Error('Payment order code mismatch');
    }

    if (Number(paymentData.amount) !== subscription.amount) {
      throw new Error('Payment amount mismatch');
    }

    if (paymentData.status && paymentData.status !== 'PAID') {
      throw new Error('Payment not completed');
    }

    if (paymentData.code && paymentData.code !== '00') {
      throw new Error('Payment not successful');
    }

    return this.activateSubscription(subscription, orderCode, paymentData.reference);
  }

  async cancelSubscription(userId: string): Promise<{ success: boolean }> {
    const user = (await this.userRepository.findById(userId)) as UserWithSubscription | null;
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has an active subscription with end date (time-limited subscription)
    if (!user.subscription?.endDate) {
      throw new Error('Only time-limited subscriptions can be cancelled');
    }

    // Update user subscription to inactive
    await this.userRepository.updateById(userId, {
      'subscription.isActive': false,
    });

    // Update subscription record - find the active subscription for this user
    const subscriptions = await this.subscriptionRepository.findByUser(userId);
    const activeSubscription = subscriptions.find(
      (sub) => sub.status === 'completed' && sub.isActive,
    ) as SubscriptionWithId | undefined;

    if (activeSubscription) {
      await this.subscriptionRepository.updateById(activeSubscription._id.toString(), {
        isActive: false,
      });
    }

    return { success: true };
  }

  private async activateSubscription(
    subscription: ISubscription,
    orderCode: number,
    transactionReference?: string,
  ): Promise<SubscriptionActivation> {
    // Idempotency check: if this PayOS transaction was already applied, do
    // not re-run the activation. Returns the existing snapshot.
    const existing = await findExistingActivation(transactionReference);
    if (existing && existing.status === 'completed') {
      return {
        success: true,
        subscription: {
          type: existing.type,
          startDate: existing.startDate ?? existing.createdAt,
          endDate: existing.endDate,
          isActive: existing.isActive,
        },
      };
    }

    // Calculate subscription dates using new duration system
    const plan = await Plan.findById(subscription.type);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const startDate = new Date();
    let endDate: Date | undefined;

    try {
      // Use new ISO 8601 duration system
      endDate = DurationUtils.calculateEndDate(startDate, plan.durationInfo.iso8601);
    } catch (error) {
      console.warn('Using fallback duration calculation for plan:', plan.name, error);

      // Fallback to legacy parsing for existing plans
      const durationText = plan.duration.toLowerCase();
      if (durationText.includes('tháng') || durationText.includes('month')) {
        const months = parseInt(durationText.match(/\d+/)?.[0] || '0');
        if (months > 0) {
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + months);
        }
      } else if (durationText === 'lifetime') {
        endDate = undefined; // Lifetime subscription
      }
    }

    // Run subscription + user updates atomically. Either both succeed or
    // both roll back, so we never end up with a paid subscription that
    // wasn't reflected on the user record (or vice versa).
    await connectDB();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Subscription.updateOne(
          { payosOrderId: orderCode.toString() },
          {
            $set: {
              status: 'completed',
              payosTransactionId: transactionReference,
              startDate,
              endDate,
              isActive: true,
            },
          },
          { session },
        );

        await User.updateOne(
          { _id: subscription.user },
          {
            $set: {
              subscription: {
                type: subscription.type,
                startDate,
                endDate,
                isActive: true,
                payosOrderId: orderCode.toString(),
                payosTransactionId: transactionReference,
              },
            },
          },
          { session },
        );
      });
    } catch (error: unknown) {
      // Duplicate-key (E11000) on payosTransactionId means another concurrent
      // webhook delivery already activated this subscription. Treat as success
      // by returning the existing snapshot.
      const isDuplicateKey =
        error instanceof Error && 'code' in error && (error as { code?: number }).code === 11000;
      if (isDuplicateKey) {
        const settled = await findExistingActivation(transactionReference);
        if (settled?.status === 'completed') {
          return {
            success: true,
            subscription: {
              type: settled.type,
              startDate: settled.startDate ?? settled.createdAt,
              endDate: settled.endDate,
              isActive: settled.isActive,
            },
          };
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }

    return {
      success: true,
      subscription: {
        type: subscription.type,
        startDate,
        endDate,
        isActive: true,
      },
    };
  }
}
