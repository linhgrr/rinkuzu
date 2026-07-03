import type { SubscriptionRecord, UserSubscription } from '@/entities/Subscription';
import type { AdminSubscriptionDto } from '@/dtos/admin-billing';
import type {
  SubscriptionHistoryItemDto,
  SubscriptionStatusResponseDto,
} from '@/dtos/subscription';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function toSubscriptionStatusDto(
  subscription: UserSubscription,
): NonNullable<SubscriptionStatusResponseDto['subscription']> {
  return {
    type: subscription.type,
    startDate: serializeOptionalDate(subscription.startDate, 'subscription.startDate'),
    endDate: serializeOptionalDate(subscription.endDate, 'subscription.endDate'),
    isActive: subscription.isActive,
    status: subscription.status,
    payosOrderId: subscription.payosOrderId,
    payosTransactionId: subscription.payosTransactionId,
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

  static toHistoryItem(subscription: SubscriptionRecord): SubscriptionHistoryItemDto {
    return {
      id: subscription.id,
      type: subscription.type,
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      payosOrderId: subscription.payosOrderId,
      payosTransactionId: subscription.payosTransactionId,
      startDate: serializeOptionalDate(subscription.startDate, 'subscription.startDate'),
      endDate: serializeOptionalDate(subscription.endDate, 'subscription.endDate'),
      isActive: subscription.isActive,
      createdAt: serializeDate(subscription.createdAt, 'subscription.createdAt'),
      updatedAt: serializeDate(subscription.updatedAt, 'subscription.updatedAt'),
    };
  }

  static toAdminSubscriptionDto(subscription: SubscriptionRecord): AdminSubscriptionDto {
    return {
      id: subscription.id,
      user: subscription.userId,
      userEmail: subscription.userEmail,
      type: subscription.type,
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      payosOrderId: subscription.payosOrderId,
      payosTransactionId: subscription.payosTransactionId,
      payosPaymentUrl: subscription.payosPaymentUrl,
      startDate: serializeOptionalDate(subscription.startDate, 'subscription.startDate'),
      endDate: serializeOptionalDate(subscription.endDate, 'subscription.endDate'),
      isActive: subscription.isActive,
      createdAt: serializeDate(subscription.createdAt, 'subscription.createdAt'),
      updatedAt: serializeDate(subscription.updatedAt, 'subscription.updatedAt'),
    };
  }
}
