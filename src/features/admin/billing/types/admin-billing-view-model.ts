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
  webhooksUnsupportedSchema: number;
  webhooksUnauthenticatedRecent: number;
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
  excessResolution: string;
  /** True while the overpayment is still an operator's to dispose of. */
  excessResolvable: boolean;
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

/**
 * One row of the webhook door's own record. The retained body is never part of
 * it — the row says whether one exists, and revealing it is a separate action.
 */
export interface AdminWebhookDiagnosticViewModel {
  id: string;
  verificationClass: string;
  status: string;
  rejectionReason?: string;
  orderCode?: string;
  eventCode?: string;
  eventDesc?: string;
  payloadHashShort: string;
  sizeLabel: string;
  retainedPayloadStored: boolean;
  retainedPayloadKeyVersion?: string;
  attemptCount: number;
  lastError?: string;
  createdAtLabel: string;
  /** Whether a replay is something this row is actually waiting on. */
  replayable: boolean;
}

export interface AdminWebhookDiagnosticListViewModel {
  webhooks: AdminWebhookDiagnosticViewModel[];
  pagination: AdminBillingPaginationViewModel;
}

export interface AdminWebhookDiagnosticQueryInput {
  page: number;
  limit: number;
  /** Empty means every class. */
  verificationClass: string;
  signal: AbortSignal;
}
