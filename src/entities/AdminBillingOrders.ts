/**
 * Domain view of the payment pipeline for operators. Dates stay as `Date`
 * here; serialization belongs to the DTO mapper.
 *
 * This shape deliberately echoes its sibling in the DTO and persistence
 * layers; see docs/architecture/three-layer-standard.md. Do not derive one
 * from another.
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
  /**
   * Signature-valid deliveries our parser could not read. Non-zero means the
   * provider's contract moved and money events are being dropped on the floor;
   * it is the one counter that indicts our code rather than an order.
   */
  webhooksUnsupportedSchema: number;
  /** Deliveries we could not authenticate in the recent window. */
  webhooksUnauthenticatedRecent: number;
}

/**
 * One inbound delivery as an operator needs to see it.
 *
 * The decrypted body is present only where retention policy allowed one to be
 * kept — a signature-valid payload we failed to parse — and only while the key
 * that sealed it is still configured. Anything else exposes a hash and a size
 * and nothing more.
 */
export interface AdminBillingWebhookDiagnosticRecord {
  id: string;
  provider: string;
  environment: string;
  verificationClass: string;
  rejectionReason?: string;
  status: string;
  orderCode?: number;
  eventCode?: string;
  eventDesc?: string;
  rawPayloadHash: string;
  rawPayloadBytes?: number;
  /** Whether a sealed body exists for this row. Never the body itself. */
  retainedPayloadStored: boolean;
  /** Which configured key sealed it, so an operator can see if it is retired. */
  retainedPayloadKeyVersion?: string;
  attemptCount: number;
  lastError?: string;
  retainUntil?: Date;
  createdAt: Date;
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
