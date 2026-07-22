import type { SubscriptionRecord, UserSubscription } from '@/entities/Subscription';
import type { AdminSubscriptionDto } from '@/dtos/admin-billing';
import type {
  PaymentCancellationReconciliationDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';
import type { SubscriptionStatus } from '@/shared/constants/subscription-status';

const CANCELLATION_OUTCOME_BY_SUBSCRIPTION_STATUS = {
  pending: 'pending',
  completed: 'paid',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'expired',
} as const satisfies Record<SubscriptionStatus, PaymentCancellationReconciliationDto['status']>;

function toSubscriptionStatusDto(
  subscription: UserSubscription,
): NonNullable<SubscriptionStatusResponseDto['subscription']> {
  const startDate = serializeOptionalDate(subscription.startDate, 'subscription.startDate');
  const endDate = serializeOptionalDate(subscription.endDate, 'subscription.endDate');
  return {
    plan: { id: subscription.planId, name: subscription.planName },
    isActive: subscription.isActive,
    ...(startDate === undefined ? {} : { startDate }),
    ...(endDate === undefined ? {} : { endDate }),
    ...(subscription.status === undefined ? {} : { status: subscription.status }),
    ...(subscription.payosOrderId === undefined ? {} : { payosOrderId: subscription.payosOrderId }),
    ...(subscription.payosTransactionId === undefined
      ? {}
      : { payosTransactionId: subscription.payosTransactionId }),
  };
}

export class SubscriptionDtoMapper {
  static toPaymentCancellationReconciliationDto(
    status: SubscriptionStatus,
  ): PaymentCancellationReconciliationDto {
    return { status: CANCELLATION_OUTCOME_BY_SUBSCRIPTION_STATUS[status] };
  }

  static toStatusResponse(
    subscription: UserSubscription | null,
    isPremium: boolean,
  ): SubscriptionStatusResponseDto {
    // Keep inactive/expired snapshots in the payload; isPremium alone gates entitlements.
    // Only users with no subscription record get subscription: null.
    return {
      subscription: subscription ? toSubscriptionStatusDto(subscription) : null,
      isPremium,
    };
  }

  static toAdminSubscriptionDto(subscription: SubscriptionRecord): AdminSubscriptionDto {
    const startDate = serializeOptionalDate(subscription.startDate, 'subscription.startDate');
    const endDate = serializeOptionalDate(subscription.endDate, 'subscription.endDate');
    return {
      id: subscription.id,
      user: subscription.userId,
      userEmail: subscription.userEmail,
      plan: { id: subscription.planId, name: subscription.planName },
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      payosOrderId: subscription.payosOrderId,
      isActive: subscription.isActive,
      createdAt: serializeDate(subscription.createdAt, 'subscription.createdAt'),
      updatedAt: serializeDate(subscription.updatedAt, 'subscription.updatedAt'),
      ...(subscription.payosTransactionId === undefined
        ? {}
        : { payosTransactionId: subscription.payosTransactionId }),
      ...(subscription.payosPaymentUrl === undefined
        ? {}
        : { payosPaymentUrl: subscription.payosPaymentUrl }),
      ...(startDate === undefined ? {} : { startDate }),
      ...(endDate === undefined ? {} : { endDate }),
    };
  }
}
