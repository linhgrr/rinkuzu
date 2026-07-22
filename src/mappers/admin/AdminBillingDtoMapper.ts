import type {
  AdminSubscriptionRecord,
  AdminUserSubscriptionGrant,
  BillingPlan,
} from '@/entities/AdminBilling';
import type {
  AdminSubscriptionListDto,
  AdminSubscriptionDto,
  AdminUserSubscriptionGrantDto,
  BillingPlanDto,
} from '@/dtos/admin-billing';
import type { PaginationMeta } from '@/dtos/common';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class AdminBillingDtoMapper {
  static toSubscriptionListDto(
    subscriptions: AdminSubscriptionRecord[],
    pagination: PaginationMeta,
  ): AdminSubscriptionListDto {
    return {
      subscriptions: subscriptions.map(AdminBillingDtoMapper.toSubscriptionDto),
      pagination,
    };
  }

  static toPlanDto(plan: BillingPlan): BillingPlanDto {
    return {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      duration: plan.duration,
      isActive: plan.isActive,
      createdAt: serializeDate(plan.createdAt, 'plan.createdAt'),
      updatedAt: serializeDate(plan.updatedAt, 'plan.updatedAt'),
    };
  }

  static toSubscriptionDto(subscription: AdminSubscriptionRecord): AdminSubscriptionDto {
    const startDate = serializeOptionalDate(subscription.startDate, 'subscription.startDate');
    const endDate = serializeOptionalDate(subscription.endDate, 'subscription.endDate');

    return {
      id: subscription.id,
      user: subscription.user,
      userEmail: subscription.userEmail,
      type: subscription.type,
      amount: subscription.amount,
      currency: subscription.currency,
      status: subscription.status,
      payosOrderId: subscription.payosOrderId,
      ...(subscription.payosTransactionId !== undefined && {
        payosTransactionId: subscription.payosTransactionId,
      }),
      ...(subscription.payosPaymentUrl !== undefined && {
        payosPaymentUrl: subscription.payosPaymentUrl,
      }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      isActive: subscription.isActive,
      createdAt: serializeDate(subscription.createdAt, 'subscription.createdAt'),
      updatedAt: serializeDate(subscription.updatedAt, 'subscription.updatedAt'),
    };
  }

  static toGrantDto(grant: AdminUserSubscriptionGrant): AdminUserSubscriptionGrantDto {
    const endDate = serializeOptionalDate(grant.endDate, 'grant.endDate');

    return {
      user: grant.userEmail,
      plan: grant.planName,
      startDate: serializeDate(grant.startDate, 'grant.startDate'),
      ...(endDate !== undefined && { endDate }),
      isActive: true,
    };
  }
}
