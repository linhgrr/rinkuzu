import crypto from 'crypto';
import mongoose, { type Model, Schema, Types } from 'mongoose';

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

const SETTLEMENT_STATUSES = [
  'unsettled',
  'settled',
  'partially_refunded',
  'refunded',
  'disputed',
  'charged_back',
  'reversed',
  'review',
] as const;
type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

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
    excessAmount: { ...moneyField, required: true, default: 0 },
    excessResolution: {
      type: String,
      enum: ['none', 'unallocated', 'refund_pending', 'refunded', 'credited', 'manually_resolved'],
      required: true,
      default: 'none',
    },
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
      enum: SETTLEMENT_STATUSES,
      required: true,
      default: 'unsettled',
    },
    fulfilledAt: { type: Date },
    providerPaidAt: { type: Date },
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

BillingOrderSchema.index({ publicId: 1 }, { unique: true });
BillingOrderSchema.index({ orderCode: 1 }, { unique: true });
BillingOrderSchema.index({ user: 1, createdAt: -1 });
BillingOrderSchema.index({ fulfillmentStatus: 1, updatedAt: 1 });

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
    nextReconcileAt: { type: Date, required: true, default: Date.now },
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
PaymentAttemptSchema.index({ collectionStatus: 1, nextReconcileAt: 1 });

const PaymentTransactionSchema = new Schema(
  {
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    environment: { type: String, required: true },
    transactionType: {
      type: String,
      enum: ['payment', 'refund', 'chargeback', 'chargeback_reversal', 'credit'],
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
      enum: [
        'received',
        'verified',
        'processing',
        'processed',
        'retryable_failure',
        'permanent_failure',
        'orphaned',
        'dead_letter',
      ],
      required: true,
      default: 'verified',
    },
    attemptCount: { type: Number, required: true, default: 0, min: 0 },
    replayGeneration: { type: Number, required: true, default: 0, min: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now },
    leaseUntil: { type: Date },
    lastError: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

PaymentWebhookInboxSchema.index(
  { provider: 1, providerAccountId: 1, environment: 1, dedupKey: 1 },
  { unique: true },
);
PaymentWebhookInboxSchema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });

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
    type: {
      type: String,
      enum: ['refund', 'chargeback', 'chargeback_reversal', 'credit'],
      required: true,
    },
    externalReference: { type: String, required: true },
    amount: moneyField,
    currency: { type: String, required: true },
    allocation: { type: String, enum: ['principal', 'excess'], required: true },
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
  settlementStatus: SettlementStatus;
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
