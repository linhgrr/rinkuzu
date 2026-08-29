import type { BillingQuotePayload } from '@/services/billing/quote-token';

/**
 * Checkout: quoting a plan, opening an order, and reading one back. Nothing
 * here settles money — that is the settlement port — and nothing here decides
 * accounting, which is the adjustment port. Keeping the three apart is what
 * lets each caller depend on the handful of operations it actually uses.
 */

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

export interface IBillingOrderRepository {
  quote(userId: string, planId: string, promoCode?: string | null): Promise<BillingQuoteResult>;
  createOrder(input: CreateBillingOrderInput): Promise<BillingOrderMutationResult>;
  getOrderByPublicId(userId: string, publicId: string): Promise<BillingOrderView>;
  createReplacementAttempt(userId: string, publicId: string): Promise<BillingOrderMutationResult>;
}
