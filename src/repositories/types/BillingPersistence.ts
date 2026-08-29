import type { Types } from 'mongoose';

/**
 * The billing rows exactly as MongoDB stores them.
 *
 * Kept apart from the domain and the ports on purpose: status fields are plain
 * strings here because persistence is the one place an unknown stored value can
 * still exist, and narrowing it is the adapter's job rather than something the
 * type system can pretend already happened.
 */

export interface BillingPlanPersistenceRecord {
  _id: string;
  name: string;
  price: number;
  duration: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface PromotionPersistenceRecord {
  _id: Types.ObjectId;
  code: string;
  normalizedCode: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  percentageCap?: number;
  fixedAmount?: number;
  currency?: 'VND';
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  reservedCount: number;
  redeemedCount: number;
  overrunCount: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  archivedAt?: Date;
  version: number;
}

export interface BillingOrderPersistenceRecord {
  _id: Types.ObjectId;
  publicId: string;
  orderCode: number;
  user: Types.ObjectId;
  planId: string;
  planName: string;
  currency: 'VND';
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  receivedAmount: number;
  /** Absent on rows written before net settlement was projected. */
  netPrincipalAmount?: number;
  excessAmount: number;
  excessResolution: string;
  durationUnit: 'day' | 'month';
  durationValue: number;
  pricingVersion: number;
  promoVersion?: number;
  termsVersion: string;
  promotionId?: Types.ObjectId;
  promotionCode?: string;
  eligibilityClass?: 'first_purchase';
  collectionStatus: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  fulfilledAt?: Date;
  providerPaidAt?: Date;
  fullyCollectedAt?: Date;
  fulfillmentNextAttemptAt?: Date;
  fulfillmentLeaseUntil?: Date;
  fulfillmentLeaseToken?: string;
  fulfillmentAttemptCount: number;
  fulfillmentLastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentAttemptPersistenceRecord {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  provider: 'payos';
  providerAccountId: string;
  environment: 'test' | 'production';
  externalOrderId?: string;
  paymentLinkId?: string;
  checkoutUrl?: string;
  currency: 'VND';
  requestedAmount: number;
  amountPaid: number;
  amountRemaining: number;
  collectionStatus: string;
  activeForCheckout: boolean;
  createOutcome: string;
  expiresAt: Date;
  terminalConfirmedAt?: Date;
  nextReconcileAt?: Date;
  reconcileCount: number;
  version: number;
  createdAt: Date;
  /** Present only while the attempt queue lease is held. */
  reconcileLeaseUntil?: Date;
  /** Identity of the worker holding the queue lease, when one is held. */
  reconcileLeaseToken?: string;
}

interface IdempotencyResponseSnapshotPersistenceRecord {
  code?: string;
  message?: string;
}

export interface IdempotencyPersistenceRecord {
  requestHash: string;
  order?: Types.ObjectId;
  status: string;
  responseStatus?: number;
  responseBodySnapshot?: IdempotencyResponseSnapshotPersistenceRecord;
}

export interface StoredPaymentTransactionPersistenceRecord {
  attempt: Types.ObjectId;
  order: Types.ObjectId;
  currency: string;
  signedAmount: number;
}

export interface WebhookInboxClaimPersistenceRecord {
  _id: Types.ObjectId;
  orderCode?: number;
  attemptCount: number;
  createdAt: Date;
}

/** The sealed body as it sits on the row; only the record below reads it. */
interface SealedWebhookPayloadPersistenceRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
}

/** Everything a reveal or a replay needs from one inbox row, and nothing else. */
export interface WebhookInboxOperationPersistenceRecord {
  _id: Types.ObjectId;
  status: string;
  verificationClass: string;
  orderCode?: number;
  encryptedRawPayload?: SealedWebhookPayloadPersistenceRecord;
}

export interface BillingAlertPersistenceRecord {
  _id: Types.ObjectId;
  key: string;
  severity: string;
  summary: string;
  action: string;
  observed: number;
  raisedAt: Date;
  /** Absent until a channel has refused the alert at least once. */
  dispatchAttempts?: number;
}

export interface ExternalMoneyAdjustmentPersistenceRecord {
  type: string;
  allocation: string;
  amount: number;
}
