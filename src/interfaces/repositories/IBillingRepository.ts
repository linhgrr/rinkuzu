import type { BillingQuotePayload } from '@/services/billing/quote-token';

interface BillingPlanSummary {
  id: string;
  name: string;
}

export interface BillingQuoteResult {
  token: string;
  quote: BillingQuotePayload;
  plan: BillingPlanSummary;
}

export interface BillingOrderView {
  id: string;
  plan: BillingPlanSummary;
  currency: 'VND';
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  receivedAmount: number;
  excessAmount: number;
  excessResolution: string;
  collectionStatus: string;
  attemptCollectionStatus?: string;
  fulfillmentStatus: string;
  settlementStatus: string;
  /** Absent once the active attempt's deadline has passed. */
  checkoutUrl?: string;
  activeAttemptId?: string;
  attemptExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillingOrderInput {
  userId: string;
  quoteToken: string;
  idempotencyKey: string;
}

export interface BillingOrderMutationResult {
  status: number;
  order: BillingOrderView;
}

export interface VerifiedPayOSWebhookInput {
  rawPayloadHash: string;
  orderCode: number;
  amount: number;
  currency: string;
  paymentLinkId: string;
  reference: string;
  transactionDateTime: string;
  counterAccountBankId?: string | null;
  counterAccountNumber?: string | null;
}

export interface PersistedWebhookResult {
  duplicate: boolean;
  inboxId: string;
}

/**
 * Both background drains call the payment provider once per item, so a batch
 * is bounded by wall-clock budget as well as item count: the scheduler runs on
 * a serverless function with a hard timeout, and a batch killed mid-flight
 * burns inbox attempt counts toward the dead-letter threshold.
 */
export interface BillingBatchOptions {
  limit?: number;
  budgetMs?: number;
}

export interface InboxProcessingResult {
  claimed: number;
  processed: number;
  /** True when the batch stopped on its time budget with work still due. */
  exhaustedBudget: boolean;
}

export interface ReconciliationResult {
  processed: number;
  exhaustedBudget: boolean;
}

export interface PromotionAdminView {
  id: string;
  code: string;
  description?: string;
  kind: 'percentage' | 'fixed';
  percentageOff?: number;
  percentageCap?: number;
  fixedAmount?: number;
  minimumSubtotal: number;
  eligibilityClass: 'public' | 'first_purchase';
  totalLimit?: number;
  perUserLimit: number;
  reservedCount: number;
  redeemedCount: number;
  overrunCount: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  version: number;
}

export interface CreatePromotionInput {
  code: string;
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
  startsAt: string;
  endsAt: string;
}

export interface CreateExternalMoneyAdjustmentInput {
  recordedBy: string;
  orderId: string;
  type: 'refund' | 'chargeback' | 'chargeback_reversal' | 'credit';
  externalReference: string;
  amount: number;
  currency: 'VND';
  allocation: 'principal' | 'excess';
  occurredAt: string;
}

export interface IBillingRepository {
  quote(userId: string, planId: string, promoCode?: string | null): Promise<BillingQuoteResult>;
  createOrder(input: CreateBillingOrderInput): Promise<BillingOrderMutationResult>;
  getOrderByPublicId(userId: string, publicId: string): Promise<BillingOrderView>;
  verifyOrder(userId: string, publicId: string): Promise<BillingOrderView>;
  cancelOrder(userId: string, publicId: string): Promise<BillingOrderView>;
  createReplacementAttempt(userId: string, publicId: string): Promise<BillingOrderMutationResult>;
  persistVerifiedPayOSWebhook(input: VerifiedPayOSWebhookInput): Promise<PersistedWebhookResult>;
  persistUnsupportedPayOSWebhook(rawPayloadHash: string): Promise<PersistedWebhookResult>;
  processInbox(options?: BillingBatchOptions): Promise<InboxProcessingResult>;
  reconcileDueAttempts(options?: BillingBatchOptions): Promise<ReconciliationResult>;
  consumeInternalNonce(nonce: string, expiresAt: Date): Promise<void>;
  listPromotions(): Promise<PromotionAdminView[]>;
  createPromotion(input: CreatePromotionInput): Promise<PromotionAdminView>;
  archivePromotion(id: string): Promise<PromotionAdminView>;
  recordExternalMoneyAdjustment(
    input: CreateExternalMoneyAdjustmentInput,
  ): Promise<BillingOrderView>;
}
