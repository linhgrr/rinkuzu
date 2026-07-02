export type AdminSubscriptionStatusViewModel =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';
export type AdminMutableSubscriptionStatusViewModel = Extract<
  AdminSubscriptionStatusViewModel,
  'failed' | 'cancelled' | 'expired'
>;

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
