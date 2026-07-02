import type {
  SubscriptionActivationDto,
  SubscriptionCancellationDto,
  VerifiedPaymentDto,
} from '@/dtos/subscription';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import type { SubscriptionRecord } from '@/entities/Subscription';
import { DurationUtils } from '@/types/subscription';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';

export class SubscriptionActivationService {
  constructor(
    private subscriptionRepository: ISubscriptionRepository,
    private userRepository: IUserRepository,
    private payosService: IPayOSService,
    private planRepository: ISubscriptionPlanRepository,
  ) {}

  async verifyAndActivateSubscription(
    orderCode: number,
    userId: string,
  ): Promise<SubscriptionActivationDto> {
    // Get subscription record
    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId !== userId) {
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
          startDate: subscription.startDate,
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

    if (!paymentInfo.data) {
      throw new Error('PayOS response missing payment data');
    }

    // Check if payment is successful (status PAID)
    if (paymentInfo.data.status !== 'PAID') {
      throw new Error('Payment not completed');
    }

    if (paymentInfo.data.orderCode !== orderCode) {
      throw new Error('Payment order code mismatch');
    }

    if (paymentInfo.data.amount !== subscription.amount) {
      throw new Error('Payment amount mismatch');
    }

    const transactionReference = paymentInfo.data.transactions.at(-1)?.reference;
    if (!transactionReference) {
      throw new Error('Paid PayOS response missing transaction reference');
    }

    return this.activateSubscription(subscription, orderCode, transactionReference);
  }

  async activateVerifiedSubscription(
    orderCode: number,
    paymentData: VerifiedPaymentDto,
  ): Promise<SubscriptionActivationDto> {
    const subscription = await this.subscriptionRepository.findByOrderId(orderCode.toString());
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status === 'completed') {
      return {
        success: true,
        subscription: {
          type: subscription.type,
          startDate: subscription.startDate,
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

  async cancelSubscription(userId: string): Promise<SubscriptionCancellationDto> {
    const result = await this.subscriptionRepository.cancelCurrentForUser(userId);
    if (result.outcome === 'user_not_found') throw new Error('User not found');
    if (result.outcome === 'not_time_limited') {
      throw new Error('Only time-limited subscriptions can be cancelled');
    }
    if (result.outcome === 'inconsistent_record') {
      throw new Error('Current subscription record is inconsistent');
    }

    return { success: true };
  }

  private async activateSubscription(
    subscription: SubscriptionRecord,
    orderCode: number,
    transactionReference?: string,
  ): Promise<SubscriptionActivationDto> {
    // Idempotency check: if this PayOS transaction was already applied, do
    // not re-run the activation. Returns the existing snapshot.
    const existing = transactionReference
      ? await this.subscriptionRepository.findByTransactionReference(transactionReference)
      : null;
    if (existing && existing.status === 'completed') {
      return {
        success: true,
        subscription: {
          type: existing.type,
          startDate: existing.startDate,
          endDate: existing.endDate,
          isActive: existing.isActive,
        },
      };
    }

    const plan = await this.planRepository.findById(subscription.type);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const startDate = new Date();
    const endDate = DurationUtils.calculateEndDate(startDate, plan.duration);

    // Run subscription + user updates atomically. Either both succeed or
    // both roll back, so we never end up with a paid subscription that
    // wasn't reflected on the user record (or vice versa).
    try {
      await this.subscriptionRepository.activateSubscription({
        orderId: orderCode.toString(),
        userId: subscription.userId,
        type: subscription.type,
        startDate,
        endDate,
        transactionReference,
      });
    } catch (error: unknown) {
      // Duplicate-key (E11000) on payosTransactionId means another concurrent
      // webhook delivery already activated this subscription. Treat as success
      // by returning the existing snapshot.
      if (isMongoDuplicateKeyError(error)) {
        const settled = transactionReference
          ? await this.subscriptionRepository.findByTransactionReference(transactionReference)
          : null;
        if (settled?.status === 'completed') {
          return {
            success: true,
            subscription: {
              type: settled.type,
              startDate: settled.startDate,
              endDate: settled.endDate,
              isActive: settled.isActive,
            },
          };
        }
      }
      throw error;
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
