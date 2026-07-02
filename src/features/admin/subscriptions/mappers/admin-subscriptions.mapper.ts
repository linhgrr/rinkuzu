import type { AdminSubscriptionDto, AdminSubscriptionListDto } from '@/dtos/admin-billing';
import { formatDateTime, formatVndCurrency } from '@/lib/formatters';
import type {
  AdminSubscriptionViewModel,
  AdminSubscriptionsListViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';

const EMPTY_FIELD_LABEL = '—';
const LIFETIME_END_DATE_LABEL = 'Lifetime';

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
    type: subscription.type,
    amount: subscription.amount,
    amountLabel: formatVndCurrency(subscription.amount),
    currency: subscription.currency,
    status: subscription.status,
    payosOrderId: subscription.payosOrderId,
    payosTransactionId: subscription.payosTransactionId,
    payosTransactionIdLabel: subscription.payosTransactionId ?? EMPTY_FIELD_LABEL,
    payosPaymentUrl: subscription.payosPaymentUrl,
    startDate: subscription.startDate,
    startDateLabel: formatOptionalDateLabel(subscription.startDate, EMPTY_FIELD_LABEL),
    endDate: subscription.endDate,
    endDateLabel: formatOptionalDateLabel(subscription.endDate, LIFETIME_END_DATE_LABEL),
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
