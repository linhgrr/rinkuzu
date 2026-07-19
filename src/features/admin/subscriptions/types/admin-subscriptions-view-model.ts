import type {
  AdminMutableSubscriptionStatus,
  SubscriptionStatus,
} from '@/shared/constants/subscription-status';

export type AdminSubscriptionStatusViewModel = SubscriptionStatus;
export type AdminMutableSubscriptionStatusViewModel = AdminMutableSubscriptionStatus;

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
  type: string;
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
  statusFilter: '' | AdminSubscriptionStatusViewModel;
  signal: AbortSignal;
}

export interface AdminSubscriptionStatusUpdateInput {
  subscriptionId: string;
  status: AdminMutableSubscriptionStatusViewModel;
}
