import type { AdminOrderBucket } from '@/shared/constants/billing-order-buckets';

export type AdminOrderBucketViewModel = AdminOrderBucket;

export interface AdminBillingHealthViewModel {
  ordersNeedingAttention: number;
  paidButUnfulfilled: number;
  attemptsInReview: number;
  attemptsIndeterminate: number;
  inboxOrphaned: number;
  inboxRetryable: number;
  inboxDeadLettered: number;
}

export interface AdminBillingOrderRowViewModel {
  id: string;
  orderCode: string;
  userId: string;
  userEmail: string;
  planName: string;
  finalAmountLabel: string;
  receivedAmountLabel: string;
  /** Set when money received does not equal money owed. */
  moneyMismatch: boolean;
  excessAmountLabel?: string;
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  attemptCollectionStatus: string;
  promotionCode?: string;
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface AdminBillingPaginationViewModel {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminBillingOrderListViewModel {
  orders: AdminBillingOrderRowViewModel[];
  pagination: AdminBillingPaginationViewModel;
  health: AdminBillingHealthViewModel;
}

export interface AdminBillingAttemptViewModel {
  id: string;
  label: string;
  collectionStatus: string;
  createOutcome: string;
  amountPaidLabel: string;
  activeForCheckout: boolean;
  reconcileCount: number;
  lastProviderError?: string;
  expiresAtLabel: string;
  nextReconcileAtLabel: string;
  createdAtLabel: string;
}

export interface AdminBillingTransactionViewModel {
  id: string;
  transactionType: string;
  externalReference: string;
  amountLabel: string;
  direction: string;
  settlementState: string;
  providerEventAtLabel: string;
}

export interface AdminBillingAdjustmentViewModel {
  id: string;
  type: string;
  externalReference: string;
  amountLabel: string;
  allocation: string;
  occurredAtLabel: string;
}

export interface AdminBillingEntitlementViewModel {
  summary: string;
  granted: boolean;
  revoked: boolean;
}

export interface AdminBillingOrderDetailViewModel {
  order: AdminBillingOrderRowViewModel;
  attempts: AdminBillingAttemptViewModel[];
  transactions: AdminBillingTransactionViewModel[];
  adjustments: AdminBillingAdjustmentViewModel[];
  entitlement: AdminBillingEntitlementViewModel;
}

export interface AdminBillingOrderQueryInput {
  page: number;
  limit: number;
  bucket: AdminOrderBucketViewModel;
  searchTerm: string;
  signal: AbortSignal;
}
