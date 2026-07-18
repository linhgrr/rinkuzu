import type {
  SubscriptionActivationDto,
  SubscriptionCancellationDto,
  VerifiedPaymentDto,
} from '@/dtos/subscription';
import { IPayOSService } from '@/interfaces/services/IPayOSService';
import { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import {
  SubscriptionActivationConflictError,
  type SubscriptionRecord,
} from '@/entities/Subscription';
import { DurationUtils } from '@/types/subscription';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
// Import cache module directly — entitlements barrel pulls subscription-factory
// and would create a runtime cycle with this service.
import { invalidateEntitlements } from '@/lib/entitlements/cache';

function toActivationDto(
  type: string,
  startDate: Date,
  endDate: Date | undefined,
  isActive: boolean,
): SubscriptionActivationDto {
  return {
    success: true,
    subscription: {
      type,
      startDate,
      ...(endDate !== undefined && { endDate }),
      isActive,
    },
  };
}

/** Successful activation result: drop process-local tier cache for this user. */
function settledActivation(
  userId: string,
  type: string,
  startDate: Date,
  endDate: Date | undefined,
  isActive: boolean,
): SubscriptionActivationDto {
  invalidateEntitlements(userId);
  return toActivationDto(type, startDate, endDate, isActive);
}

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

      // Idempotent success: authoritative completed state — clear stale free tier.
      return settledActivation(
        subscription.userId,
        subscription.type,
        subscription.startDate,
        subscription.endDate,
        subscription.isActive,
      );
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
      // Idempotent success: authoritative completed state — clear stale free tier.
      return settledActivation(
        subscription.userId,
        subscription.type,
        subscription.startDate,
        subscription.endDate,
        subscription.isActive,
      );
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

    // `cancelled` mutated state; `already_inactive` is idempotent success.
    // Both mean the user is not entitled to premium — drop a possibly stale tier.
    invalidateEntitlements(userId);
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
      // Same order/user as the pending activation — always invalidate that user.
      return settledActivation(
        subscription.userId,
        existing.type,
        existing.startDate,
        existing.endDate,
        existing.isActive,
      );
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
        ...(transactionReference !== undefined && { transactionReference }),
      });
    } catch (error: unknown) {
      if (error instanceof SubscriptionActivationConflictError) {
        const settled = await this.subscriptionRepository.findByOrderId(orderCode.toString());
        if (settled?.status === 'completed') {
          // Concurrent writer already committed — invalidate after durable settle.
          return settledActivation(
            subscription.userId,
            settled.type,
            settled.startDate,
            settled.endDate,
            settled.isActive,
          );
        }
      }

      // Duplicate-key (E11000) on payosTransactionId means another concurrent
      // webhook delivery already activated this subscription. Treat as success
      // by returning the existing snapshot.
      if (isMongoDuplicateKeyError(error)) {
        const settled = transactionReference
          ? await this.subscriptionRepository.findByTransactionReference(transactionReference)
          : null;
        if (settled?.status === 'completed') {
          return settledActivation(
            subscription.userId,
            settled.type,
            settled.startDate,
            settled.endDate,
            settled.isActive,
          );
        }
      }
      throw error;
    }

    // Invalidate only after the durable activation commit succeeded.
    return settledActivation(subscription.userId, subscription.type, startDate, endDate, true);
  }
}
