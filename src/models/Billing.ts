import crypto from 'crypto';
import mongoose, { type Model, Schema, Types } from 'mongoose';
import {
  BILLING_ALERT_KEYS,
  BILLING_ALERT_SEVERITIES,
} from '@/services/billing/alerting/billing-alerts';
import { EXCESS_RESOLUTIONS } from '@/services/billing/domain/excess-resolution';
import {
  MONEY_ADJUSTMENT_TYPES,
  MONEY_ALLOCATIONS,
  SETTLEMENT_STATES,
  type SettlementState,
} from '@/services/billing/domain/settlement-math';
import {
  WEBHOOK_REJECTION_REASONS,
  WEBHOOK_VERIFICATION_CLASSES,
} from '@/services/billing/domain/webhook-diagnostics';

const PAYMENT_COLLECTION_STATUSES = [
  'creating',
  'pending',
  'partial',
  'paid',
  'cancelled',
  'expired',
  'failed',
  'review',
] as const;

const ORDER_COLLECTION_STATUSES = ['unpaid', 'partial', 'paid', 'overpaid', 'review'] as const;
type OrderCollectionStatus = (typeof ORDER_COLLECTION_STATUSES)[number];

const FULFILLMENT_STATUSES = [
  'unfulfilled',
  'processing',
  'fulfilled',
  'revoked',
  'review',
] as const;
type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

const WEBHOOK_INBOX_STATUSES = [
  /** Authenticated payment event, queued for the drain. */
  'verified',
  'processing',
  'processed',
  'retryable_failure',
  'permanent_failure',
  'orphaned',
  'dead_letter',
  /** Authenticated, understood, deliberately not acted on. */
  'ignored',
  /** Never authenticated; kept as a diagnostic and nothing more. */
  'rejected',
] as const;

const moneyField = {
  type: Number,
  required: true,
  min: 0,
  validate: {
    validator: Number.isSafeInteger,
    message: 'Money must be an integer in minor units',
  },
} as const;

const BillingOrderSchema = new Schema(
  {
    publicId: { type: String, required: true, default: () => crypto.randomUUID() },
    orderCode: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'orderCode must be a safe integer' },
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true, trim: true },
    currency: { type: String, required: true, enum: ['VND'] },
    baseAmount: moneyField,
    discountAmount: moneyField,
    finalAmount: { ...moneyField, min: 2_000 },
    receivedAmount: { ...moneyField, required: true, default: 0 },
    /**
     * What the merchant has actually kept: payments in, refunds, chargebacks
     * and write-offs out, merchant credits back in. Entitlement is this against
     * `finalAmount`, and both the fulfillment claim and the fulfillment commit
     * fence on it, so a refund recorded before or during fulfillment withholds
     * the grant instead of racing it.
     *
     * Rows written before this field existed carry no value; every read falls
     * back to `receivedAmount`, which is the same number for an order that has
     * no adjustments, and the first settlement observation writes it for real.
     */
    netPrincipalAmount: {
      type: Number,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Money must be an integer in minor units',
      },
    },
    excessAmount: { ...moneyField, required: true, default: 0 },
    excessResolution: {
      type: String,
      enum: EXCESS_RESOLUTIONS,
      required: true,
      default: 'none',
    },
    /** Why an operator disposed of the overpayment the way they did. */
    excessResolutionReason: { type: String, maxlength: 1_000 },
    excessResolvedAt: { type: Date },
    excessResolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    durationUnit: { type: String, enum: ['day', 'month'], required: true },
    durationValue: { type: Number, required: true, min: 1, validate: Number.isInteger },
    pricingVersion: { type: Number, required: true, min: 1, validate: Number.isInteger },
    promoVersion: { type: Number, min: 1, validate: Number.isInteger },
    termsVersion: { type: String, required: true },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    promotionCode: { type: String },
    eligibilityClass: { type: String, enum: ['first_purchase'] },
    collectionStatus: {
      type: String,
      enum: ORDER_COLLECTION_STATUSES,
      required: true,
      default: 'unpaid',
    },
    fulfillmentStatus: {
      type: String,
      enum: FULFILLMENT_STATUSES,
      required: true,
      default: 'unfulfilled',
    },
    settlementStatus: {
      type: String,
      enum: SETTLEMENT_STATES,
      required: true,
      default: 'unsettled',
    },
    fulfilledAt: { type: Date },
    providerPaidAt: { type: Date },
    /**
     * When the order was first observed fully collected. Distinct from
     * `providerPaidAt`, which is the earliest incoming transaction: an order
     * part-paid in March and completed today became collected today, and the
     * fulfillment backoff must age from the completion, not from the deposit.
     */
    fullyCollectedAt: { type: Date },
    // The paid-unfulfilled work item. Money observation commits these in the
    // same transaction that records the payment, so an order that is paid is
    // always also queued for fulfillment; the lease keeps two workers off the
    // same order and the attempt count eventually stops a poison order from
    // retrying forever without ever blocking the orders behind it.
    fulfillmentNextAttemptAt: { type: Date },
    fulfillmentLeaseUntil: { type: Date },
    /**
     * Identity of the worker that currently holds the lease. Every write a
     * fulfillment worker makes after claiming quotes the token it was given, so
     * a worker whose lease expired cannot overwrite the state of the worker
     * that reclaimed the order after it.
     */
    fulfillmentLeaseToken: { type: String },
    fulfillmentAttemptCount: { type: Number, required: true, default: 0, min: 0 },
    /** Free-text operator note: the transient error, or the review reason. */
    fulfillmentLastError: { type: String },
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

BillingOrderSchema.index({ publicId: 1 }, { unique: true });
BillingOrderSchema.index({ orderCode: 1 }, { unique: true });
BillingOrderSchema.index({ user: 1, createdAt: -1 });
BillingOrderSchema.index({ fulfillmentStatus: 1, updatedAt: 1 });
BillingOrderSchema.index({ fulfillmentStatus: 1, fulfillmentNextAttemptAt: 1 });

const PaymentAttemptSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder', required: true },
    provider: { type: String, required: true, enum: ['payos'] },
    providerAccountId: { type: String, required: true },
    environment: { type: String, required: true, enum: ['test', 'production'] },
    externalOrderId: { type: String },
    paymentLinkId: { type: String },
    checkoutUrl: { type: String },
    currency: { type: String, required: true, enum: ['VND'] },
    requestedAmount: moneyField,
    amountPaid: { ...moneyField, required: true, default: 0 },
    amountRemaining: moneyField,
    collectionStatus: {
      type: String,
      enum: PAYMENT_COLLECTION_STATUSES,
      required: true,
      default: 'creating',
    },
    activeForCheckout: { type: Boolean, required: true, default: true },
    createOutcome: {
      type: String,
      enum: ['not_started', 'created', 'indeterminate', 'definite_failure'],
      required: true,
      default: 'not_started',
    },
    expiresAt: { type: Date, required: true },
    terminalConfirmedAt: { type: Date },
    /**
     * When automation should look at this attempt again. Absent means never:
     * an attempt handed to an operator, or one whose late-money watch window
     * has closed, leaves the queue entirely rather than being re-selected on
     * every tick forever.
     */
    nextReconcileAt: { type: Date, default: Date.now },
    /**
     * How long this attempt is held out of the due selector by the drain that
     * took it. A queue claim only: the transitions themselves are guarded by
     * `version`, so an expired lease costs a duplicated provider call and never
     * a duplicated write.
     */
    reconcileLeaseUntil: { type: Date },
    /**
     * Identity of the worker that currently owns this attempt's reconciliation
     * slot. Every write a settlement run makes quotes the token it claimed
     * with, so a worker whose lease expired cannot escalate, reschedule or
     * transition an attempt that another worker — or a newer, paid settlement —
     * has since taken over.
     */
    reconcileLeaseToken: { type: String },
    reconcileCount: { type: Number, required: true, default: 0, min: 0 },
    lastProviderError: { type: String },
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

PaymentAttemptSchema.index({ order: 1, createdAt: -1 });
PaymentAttemptSchema.index(
  { order: 1, activeForCheckout: 1 },
  { unique: true, partialFilterExpression: { activeForCheckout: true } },
);
PaymentAttemptSchema.index(
  { provider: 1, providerAccountId: 1, environment: 1, externalOrderId: 1 },
  { unique: true, partialFilterExpression: { externalOrderId: { $type: 'string' } } },
);
PaymentAttemptSchema.index(
  { provider: 1, providerAccountId: 1, environment: 1, paymentLinkId: 1 },
  { unique: true, partialFilterExpression: { paymentLinkId: { $type: 'string' } } },
);
PaymentAttemptSchema.index({ collectionStatus: 1, nextReconcileAt: 1, reconcileLeaseUntil: 1 });

const PaymentTransactionSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    environment: { type: String, required: true },
    transactionType: {
      type: String,
      enum: ['payment', ...MONEY_ADJUSTMENT_TYPES],
      required: true,
    },
    externalReference: { type: String, required: true },
    attempt: { type: Schema.Types.ObjectId, ref: 'PaymentAttempt', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder', required: true },
    currency: { type: String, required: true },
    signedAmount: {
      type: Number,
      required: true,
      validate: { validator: Number.isSafeInteger, message: 'signedAmount must be a safe integer' },
    },
    direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
    providerEventAt: { type: Date, required: true },
    settlementState: {
      type: String,
      enum: ['observed', 'confirmed', 'reversed', 'review'],
      required: true,
      default: 'observed',
    },
    rawPayloadHash: { type: String, required: true },
  },
  { timestamps: true },
);

PaymentTransactionSchema.index(
  {
    provider: 1,
    providerAccountId: 1,
    environment: 1,
    transactionType: 1,
    externalReference: 1,
  },
  { unique: true },
);
PaymentTransactionSchema.index({ order: 1, providerEventAt: 1 });

const IdempotencyResponseSnapshotSchema = new Schema(
  {
    orderId: { type: String },
    code: { type: String },
    message: { type: String },
  },
  { _id: false, strict: true },
);

const IdempotencyRecordSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    apiVersion: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder' },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed_deterministic'],
      required: true,
    },
    responseVersion: { type: Number, required: true, default: 1 },
    responseStatus: { type: Number },
    responseBodySnapshot: { type: IdempotencyResponseSnapshotSchema },
  },
  { timestamps: true },
);

IdempotencyRecordSchema.index(
  { user: 1, endpoint: 1, apiVersion: 1, idempotencyKey: 1 },
  { unique: true },
);

const PromotionSchema = new Schema(
  {
    code: { type: String, required: true },
    normalizedCode: { type: String, required: true },
    description: { type: String, maxlength: 500 },
    kind: { type: String, enum: ['percentage', 'fixed'], required: true },
    percentageOff: {
      type: Number,
      min: 1,
      max: 100,
      required(this: { kind: string }): boolean {
        return this.kind === 'percentage';
      },
    },
    percentageCap: { ...moneyField, required: false },
    fixedAmount: {
      ...moneyField,
      required(this: { kind: string }): boolean {
        return this.kind === 'fixed';
      },
    },
    currency: { type: String, enum: ['VND'] },
    minimumSubtotal: { ...moneyField, required: true, default: 0 },
    eligibilityClass: { type: String, enum: ['public', 'first_purchase'], required: true },
    totalLimit: { type: Number, min: 1, validate: Number.isInteger },
    perUserLimit: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger },
    reservedCount: { type: Number, required: true, default: 0, min: 0 },
    redeemedCount: { type: Number, required: true, default: 0, min: 0 },
    overrunCount: { type: Number, required: true, default: 0, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, required: true, default: true },
    archivedAt: { type: Date },
    version: { type: Number, required: true, default: 1, min: 1 },
    financialRulesLockedAt: { type: Date },
  },
  { timestamps: true },
);

PromotionSchema.index({ normalizedCode: 1 }, { unique: true });
PromotionSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

const PromotionRedemptionSchema = new Schema(
  {
    promotion: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['reserved', 'redeemed', 'released', 'late_redeemed'],
      required: true,
    },
    discountAmount: moneyField,
    reservedAt: { type: Date, required: true },
    redeemedAt: { type: Date },
    releasedAt: { type: Date },
    releaseReason: { type: String },
    nextReleaseCheckAt: { type: Date },
    releaseAttemptCount: { type: Number, required: true, default: 0, min: 0 },
    lastReleaseError: { type: String, maxlength: 1_000 },
  },
  { timestamps: true },
);

PromotionRedemptionSchema.index({ promotion: 1, order: 1 }, { unique: true });
PromotionRedemptionSchema.index({ promotion: 1, user: 1, status: 1 });
PromotionRedemptionSchema.index({ status: 1, nextReleaseCheckAt: 1 });

const firstPurchaseIdentityFields = {
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  eligibilityClass: { type: String, enum: ['first_purchase'], required: true },
} as const;

const firstPurchaseLifecycleFields = {
  reservedAt: { type: Date },
  consumedAt: { type: Date },
  releasedAt: { type: Date },
} as const;

const FirstPurchaseClaimSchema = new Schema(
  {
    ...firstPurchaseIdentityFields,
    status: {
      type: String,
      enum: ['reserved', 'consumed', 'released', 'late_consumed'],
      required: true,
    },
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder', required: true },
    ...firstPurchaseLifecycleFields,
    reservedAt: { ...firstPurchaseLifecycleFields.reservedAt, required: true },
    releaseReason: { type: String, maxlength: 120 },
  },
  { timestamps: true },
);

// Claims are immutable history. Only one reservation may be active for a user,
// while released/consumed claims remain queryable for late-payment reconciliation.
FirstPurchaseClaimSchema.index(
  { user: 1, eligibilityClass: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'reserved' },
  },
);
FirstPurchaseClaimSchema.index({ order: 1 }, { unique: true });

const FirstPurchaseEligibilitySchema = new Schema(
  {
    ...firstPurchaseIdentityFields,
    status: {
      type: String,
      enum: ['available', 'reserved', 'consumed'],
      required: true,
      default: 'available',
    },
    activeOrder: { type: Schema.Types.ObjectId, ref: 'BillingOrder' },
    ...firstPurchaseLifecycleFields,
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// This singleton is the serialization point for first-purchase eligibility.
// FirstPurchaseClaim remains the immutable per-order history used for audit
// and late-payment handling.
FirstPurchaseEligibilitySchema.index({ user: 1, eligibilityClass: 1 }, { unique: true });

const PromotionUserCounterSchema = new Schema(
  {
    promotion: { type: Schema.Types.ObjectId, ref: 'Promotion', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reservedCount: { type: Number, required: true, default: 0, min: 0 },
    redeemedCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

PromotionUserCounterSchema.index({ promotion: 1, user: 1 }, { unique: true });

const NormalizedWebhookPayloadSchema = new Schema(
  {
    orderCode: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentLinkId: { type: String, required: true },
    reference: { type: String, required: true },
    transactionDateTime: { type: String, required: true },
    payerSignal: { type: String, default: null },
    payerSignalKeyVersion: { type: String, default: null },
    payerSignalNormalizedVersion: { type: Number, default: null },
  },
  { _id: false, strict: true },
);

/**
 * A webhook body kept under envelope encryption. Only signature-valid payloads
 * our schema could not read are ever stored, and only while a payload key is
 * configured; see `src/services/billing/domain/webhook-payload-cipher.ts`.
 */
const SealedWebhookPayloadSchema = new Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: String, required: true },
  },
  { _id: false, strict: true },
);

const PaymentWebhookInboxSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    environment: { type: String, required: true },
    dedupKey: { type: String, required: true },
    orderCode: { type: Number },
    paymentLinkId: { type: String },
    transactionReference: { type: String },
    normalizedPayload: { type: NormalizedWebhookPayloadSchema },
    rawPayloadHash: { type: String, required: true },
    normalizerVersion: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: WEBHOOK_INBOX_STATUSES,
      required: true,
      default: 'verified',
    },
    /** What we were able to prove about the request, before deciding anything. */
    verificationClass: {
      type: String,
      enum: WEBHOOK_VERIFICATION_CLASSES,
      required: true,
      default: 'accepted',
    },
    /** Why an unauthenticated request was turned away. */
    rejectionReason: {
      type: String,
      enum: WEBHOOK_REJECTION_REASONS,
    },
    rawPayloadBytes: { type: Number, min: 0 },
    /** Keyed hash of the caller's address; never the address itself. */
    sourceIpHash: { type: String },
    eventCode: { type: String, maxlength: 50 },
    eventDesc: { type: String, maxlength: 200 },
    encryptedRawPayload: { type: SealedWebhookPayloadSchema },
    /** When the row expires. Absent on accounting records, which are kept. */
    retainUntil: { type: Date },
    attemptCount: { type: Number, required: true, default: 0, min: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    leaseUntil: { type: Date },
    /**
     * Identity of the worker holding the inbox claim. Completions and
     * reschedules quote it, so a worker that stalled past its lease cannot mark
     * an event processed after another worker reclaimed and re-queued it.
     */
    leaseToken: { type: String },
    lastError: { type: String },
    processedAt: { type: Date },
    /** Who last replayed this row, and when; a replay is an audited action. */
    replayedAt: { type: Date },
    replayedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

PaymentWebhookInboxSchema.index(
  { provider: 1, providerAccountId: 1, environment: 1, dedupKey: 1 },
  { unique: true },
);
PaymentWebhookInboxSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
PaymentWebhookInboxSchema.index({ verificationClass: 1, createdAt: -1 });
// The diagnostics panel opens unnarrowed, and the compound index above cannot
// serve that read: with no verification class to seek on, the sort falls back
// to a collection scan over every delivery ever received. That collection grows
// with unauthenticated internet noise as much as with real payments, so the
// scan has no ceiling and the in-memory sort eventually exceeds its limit —
// making the page an operator opens during an incident the first thing to fail.
PaymentWebhookInboxSchema.index({ createdAt: -1 });
// Diagnostics age out on their own so an unauthenticated door cannot become an
// unbounded store of attacker-controlled text. Accounting rows carry no
// `retainUntil` and a partial TTL index leaves them alone.
PaymentWebhookInboxSchema.index(
  { retainUntil: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { retainUntil: { $type: 'date' } } },
);

const EntitlementAccountSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, required: true, default: 0, min: 0 },
    nextSequence: { type: Number, required: true, default: 1, min: 1 },
    planId: { type: String },
    planName: { type: String },
    currentStartAt: { type: Date },
    currentEndAt: { type: Date },
    perpetual: { type: Boolean, required: true, default: false },
    lastCheckpointSequence: { type: Number, required: true, default: 0, min: 0 },
    projectionChecksum: { type: String },
  },
  { timestamps: true },
);

EntitlementAccountSchema.index({ user: 1 }, { unique: true });
EntitlementAccountSchema.index({ currentEndAt: 1 });

const EntitlementGrantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sourceType: { type: String, enum: ['billing_order', 'manual', 'migration'], required: true },
    sourceId: { type: String, required: true },
    sequence: { type: Number, required: true, min: 1 },
    segmentId: { type: String, required: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    durationUnit: { type: String, enum: ['day', 'month', 'perpetual'], required: true },
    durationValue: { type: Number, min: 1, validate: Number.isInteger },
    segmentBaselineStartAt: { type: Date, required: true },
    segmentAnchorDay: { type: Number, required: true, min: 1, max: 31 },
    committedAt: { type: Date, required: true },
    providerPaidAt: { type: Date },
    originalEffectiveStartAt: { type: Date, required: true },
    originalEffectiveEndAt: { type: Date },
  },
  { timestamps: true },
);

EntitlementGrantSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
EntitlementGrantSchema.index({ user: 1, sequence: 1 }, { unique: true });

const EntitlementAdjustmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    grant: { type: Schema.Types.ObjectId, ref: 'EntitlementGrant', required: true },
    sequence: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ['revoke', 'restore'], required: true },
    sourceType: {
      type: String,
      enum: ['refund', 'chargeback', 'reversal', 'admin'],
      required: true,
    },
    sourceId: { type: String, required: true },
    reason: { type: String, maxlength: 1_000 },
    committedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

EntitlementAdjustmentSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
EntitlementAdjustmentSchema.index({ user: 1, sequence: 1 }, { unique: true });

const ExternalMoneyAdjustmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'BillingOrder', required: true },
    paymentTransaction: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', required: true },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    environment: { type: String, required: true },
    type: { type: String, enum: MONEY_ADJUSTMENT_TYPES, required: true },
    externalReference: { type: String, required: true },
    amount: moneyField,
    currency: { type: String, required: true },
    allocation: { type: String, enum: MONEY_ALLOCATIONS, required: true },
    occurredAt: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ExternalMoneyAdjustmentSchema.index(
  { provider: 1, providerAccountId: 1, environment: 1, type: 1, externalReference: 1 },
  { unique: true },
);
ExternalMoneyAdjustmentSchema.index({ order: 1, occurredAt: 1 });

const BillingCounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: {
      type: Number,
      required: true,
      default: () => Date.now() * 1_000,
      validate: { validator: Number.isSafeInteger, message: 'Counter must be a safe integer' },
    },
  },
  { versionKey: false },
);

const InternalRequestNonceSchema = new Schema(
  {
    nonce: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
InternalRequestNonceSchema.index({ nonce: 1 }, { unique: true });

/**
 * One raised billing alert.
 *
 * Written before anything tries to deliver it, so a condition detected while no
 * channel is configured is still on the record and still counted rather than
 * vanishing into a log line. `cooldownUntil` on a unique key is the whole
 * deduplication mechanism: raising is a conditional upsert against it, so a
 * scheduler running every minute announces a standing backlog once per cooldown
 * and two schedulers racing announce it once.
 */
const BillingAlertSchema = new Schema(
  {
    key: { type: String, enum: BILLING_ALERT_KEYS, required: true },
    severity: { type: String, enum: BILLING_ALERT_SEVERITIES, required: true },
    observed: { type: Number, required: true, min: 0 },
    threshold: { type: Number, required: true, min: 0 },
    summary: { type: String, required: true, maxlength: 500 },
    action: { type: String, required: true, maxlength: 500 },
    raisedAt: { type: Date, required: true },
    cooldownUntil: { type: Date, required: true },
    /** Set once, on success only. Its absence is what keeps an alert queued. */
    dispatchedAt: { type: Date },
    /** Why delivery could not happen, verbatim. Absent when it did. */
    dispatchBlocker: { type: String, maxlength: 500 },
    /** Not before this instant is a refused alert offered to a channel again. */
    dispatchRetryAt: { type: Date },
    /** Refusals so far, which is what the backoff above is computed from. */
    dispatchAttempts: { type: Number, min: 0 },
    lastDispatchAttemptAt: { type: Date },
  },
  { timestamps: true },
);
BillingAlertSchema.index({ key: 1 }, { unique: true });
// The delivery sweep reads what is undelivered, oldest first, and then narrows
// by retry time. One row per key is guaranteed by the unique index above, so the
// narrowing runs over a handful of documents and earns no index of its own.
BillingAlertSchema.index({ dispatchedAt: 1, raisedAt: 1 });
InternalRequestNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

type LooseBillingRecord = Record<string, unknown>;

function model(name: string, schema: Schema): Model<LooseBillingRecord> {
  return (
    (mongoose.models[name] as Model<LooseBillingRecord> | undefined) ??
    mongoose.model<LooseBillingRecord>(name, schema)
  );
}

export type BillingOrderRecord = {
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
  excessAmount: number;
  collectionStatus: OrderCollectionStatus;
  fulfillmentStatus: FulfillmentStatus;
  settlementStatus: SettlementState;
  durationUnit: 'day' | 'month';
  durationValue: number;
  pricingVersion: number;
  termsVersion: string;
  version: number;
};

export const BillingOrder =
  (mongoose.models['BillingOrder'] as Model<BillingOrderRecord> | undefined) ??
  mongoose.model<BillingOrderRecord>('BillingOrder', BillingOrderSchema);
export const PaymentAttempt = model('PaymentAttempt', PaymentAttemptSchema);
export const PaymentTransaction = model('PaymentTransaction', PaymentTransactionSchema);
export const IdempotencyRecord = model('IdempotencyRecord', IdempotencyRecordSchema);
export const Promotion = model('Promotion', PromotionSchema);
export const PromotionRedemption = model('PromotionRedemption', PromotionRedemptionSchema);
export const FirstPurchaseClaim = model('FirstPurchaseClaim', FirstPurchaseClaimSchema);
export const FirstPurchaseEligibility = model(
  'FirstPurchaseEligibility',
  FirstPurchaseEligibilitySchema,
);
export const PromotionUserCounter = model('PromotionUserCounter', PromotionUserCounterSchema);
export const PaymentWebhookInbox = model('PaymentWebhookInbox', PaymentWebhookInboxSchema);
export const EntitlementAccount = model('EntitlementAccount', EntitlementAccountSchema);
export const EntitlementGrant = model('EntitlementGrant', EntitlementGrantSchema);
export const EntitlementAdjustment = model('EntitlementAdjustment', EntitlementAdjustmentSchema);
export const ExternalMoneyAdjustment = model(
  'ExternalMoneyAdjustment',
  ExternalMoneyAdjustmentSchema,
);
export const BillingCounter = model('BillingCounter', BillingCounterSchema);
export const InternalRequestNonce = model('InternalRequestNonce', InternalRequestNonceSchema);
export const BillingAlert = model('BillingAlert', BillingAlertSchema);
