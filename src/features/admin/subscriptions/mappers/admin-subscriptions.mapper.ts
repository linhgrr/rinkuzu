import type { AdminSubscriptionDto, AdminSubscriptionListDto } from '@/dtos/admin-billing';
import { formatDateTime, formatVndCurrency } from '@/lib/formatters';
import type {
  AdminSubscriptionViewModel,
  AdminSubscriptionsListViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';

const EMPTY_FIELD_LABEL = '—';
function formatEndDateLabel(value: string | undefined): string {
  return value ? formatDateTime(value, { emptyLabel: EMPTY_FIELD_LABEL }) : EMPTY_FIELD_LABEL;
}

function formatOptionalDateLabel(value: string | undefined, emptyLabel: string): string {
  return value
    ? formatDateTime(value, {
        emptyLabel: EMPTY_FIELD_LABEL,
      })
    : emptyLabel;
}

export function toAdminSubscriptionViewModel(
  subscription: AdminSubscriptionDto,
): AdminSubscriptionViewModel {
  return {
    id: subscription.id,
    userId: subscription.user,
    userEmail: subscription.userEmail,
    plan: subscription.plan,
    amount: subscription.amount,
    amountLabel: formatVndCurrency(subscription.amount),
    currency: subscription.currency,
    status: subscription.status,
    payosOrderId: subscription.payosOrderId,
    ...(subscription.payosTransactionId !== undefined && {
      payosTransactionId: subscription.payosTransactionId,
    }),
    payosTransactionIdLabel: subscription.payosTransactionId ?? EMPTY_FIELD_LABEL,
    ...(subscription.payosPaymentUrl !== undefined && {
      payosPaymentUrl: subscription.payosPaymentUrl,
    }),
    ...(subscription.startDate !== undefined && { startDate: subscription.startDate }),
    startDateLabel: formatOptionalDateLabel(subscription.startDate, EMPTY_FIELD_LABEL),
    ...(subscription.endDate !== undefined && { endDate: subscription.endDate }),
    endDateLabel: formatEndDateLabel(subscription.endDate),
    isActive: subscription.isActive,
    createdAt: subscription.createdAt,
    createdAtLabel: formatDateTime(subscription.createdAt, { emptyLabel: EMPTY_FIELD_LABEL }),
    updatedAt: subscription.updatedAt,
    updatedAtLabel: formatDateTime(subscription.updatedAt, { emptyLabel: EMPTY_FIELD_LABEL }),
  };
}

export function toAdminSubscriptionsListViewModel(
  dto: AdminSubscriptionListDto,
): AdminSubscriptionsListViewModel {
  return {
    subscriptions: dto.subscriptions.map(toAdminSubscriptionViewModel),
    pagination: {
      page: dto.pagination.currentPage,
      limit: dto.pagination.itemsPerPage,
      total: dto.pagination.totalItems,
      totalPages: dto.pagination.totalPages,
    },
  };
}
