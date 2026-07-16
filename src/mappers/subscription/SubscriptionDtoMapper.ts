import type { SubscriptionRecord, UserSubscription } from '@/entities/Subscription';
import type { AdminSubscriptionDto } from '@/dtos/admin-billing';
import type { SubscriptionStatusResponseDto } from '@/dtos/subscription';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function toSubscriptionStatusDto(
  subscription: UserSubscription,
): NonNullable<SubscriptionStatusResponseDto['subscription']> {
  const startDate = serializeOptionalDate(subscription.startDate, 'subscription.startDate');
  const endDate = serializeOptionalDate(subscription.endDate, 'subscription.endDate');
  return {
    type: subscription.type,
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
  static toStatusResponse(
    subscription: UserSubscription | null,
    isPremium: boolean,
  ): SubscriptionStatusResponseDto {
    return {
      subscription: isPremium && subscription ? toSubscriptionStatusDto(subscription) : null,
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
      type: subscription.type,
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
