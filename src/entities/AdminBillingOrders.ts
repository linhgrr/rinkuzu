/**
 * Domain view of the payment pipeline for operators. Dates stay as `Date`
 * here; serialization belongs to the DTO mapper.
 */
export interface AdminBillingOrderRecord {
  publicId: string;
  orderCode: number;
  userId: string;
  userEmail?: string;
  planId: string;
  planName: string;
  currency: string;
  finalAmount: number;
  receivedAmount: number;
  excessAmount: number;
  excessResolution: string;
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  attemptCollectionStatus?: string;
  promotionCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminBillingHealthSnapshot {
  ordersNeedingAttention: number;
  paidButUnfulfilled: number;
  attemptsInReview: number;
  /** Provider never confirmed whether a checkout link exists. */
  attemptsIndeterminate: number;
  inboxOrphaned: number;
  inboxRetryable: number;
  inboxDeadLettered: number;
}

export interface AdminBillingAttemptRecord {
  id: string;
  provider: string;
  environment: string;
  externalOrderId?: string;
  paymentLinkId?: string;
  requestedAmount: number;
  amountPaid: number;
  collectionStatus: string;
  createOutcome: string;
  activeForCheckout: boolean;
  reconcileCount: number;
  lastProviderError?: string;
  expiresAt: Date;
  nextReconcileAt: Date;
  createdAt: Date;
}

export interface AdminBillingTransactionRecord {
  id: string;
  transactionType: string;
  externalReference: string;
  signedAmount: number;
  direction: string;
  settlementState: string;
  providerEventAt: Date;
}

export interface AdminBillingAdjustmentRecord {
  id: string;
  type: string;
  externalReference: string;
  amount: number;
  allocation: string;
  occurredAt: Date;
}

export interface AdminBillingEntitlementSnapshot {
  granted: boolean;
  revoked: boolean;
  currentEndAt?: Date;
  perpetual: boolean;
}

export interface AdminBillingOrderDetailRecord {
  order: AdminBillingOrderRecord;
  attempts: AdminBillingAttemptRecord[];
  transactions: AdminBillingTransactionRecord[];
  adjustments: AdminBillingAdjustmentRecord[];
  entitlement: AdminBillingEntitlementSnapshot;
}
