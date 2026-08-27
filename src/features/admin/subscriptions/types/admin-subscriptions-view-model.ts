import type {
  DerivedSubscriptionStatus,
  SubscriptionStatus,
} from '@/shared/constants/subscription-status';

export type AdminSubscriptionStatusViewModel = SubscriptionStatus;
/** Statuses the list can actually return, and therefore filter by. */
export type AdminFilterableSubscriptionStatusViewModel = DerivedSubscriptionStatus;

export interface AdminSubscriptionsPaginationViewModel {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminSubscriptionViewModel {
  id: string;
  userId: string;
  userEmail: string;
  plan: {
    id: string;
    name: string;
  };
  amount: number;
  amountLabel: string;
  currency: string;
  status: AdminSubscriptionStatusViewModel;
  payosOrderId: string;
  payosTransactionId?: string;
  payosTransactionIdLabel: string;
  payosPaymentUrl?: string;
  startDate?: string;
  startDateLabel: string;
  endDate?: string;
  endDateLabel: string;
  isActive: boolean;
  createdAt: string;
  createdAtLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
}

export interface AdminSubscriptionsListViewModel {
  subscriptions: AdminSubscriptionViewModel[];
  pagination: AdminSubscriptionsPaginationViewModel;
}

export interface AdminSubscriptionsQueryInput {
  page: number;
  limit: number;
  searchTerm: string;
  statusFilter: '' | AdminFilterableSubscriptionStatusViewModel;
  signal: AbortSignal;
}

export interface AdminSubscriptionRevokeInput {
  subscriptionId: string;
  reason: string;
}
