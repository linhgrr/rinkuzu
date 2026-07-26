import type {
  BillingOrderMutationResult,
  BillingOrderView,
  BillingQuoteResult,
  CreateBillingOrderInput,
  CreateExternalMoneyAdjustmentInput,
  CreatePromotionInput,
  IBillingRepository,
  InboxProcessingResult,
  PersistedWebhookResult,
  ReconciliationResult,
  PromotionAdminView,
  VerifiedPayOSWebhookInput,
} from '@/interfaces/repositories/IBillingRepository';

export class BillingService {
  constructor(private readonly repository: IBillingRepository) {}

  quote(userId: string, planId: string, promoCode?: string | null): Promise<BillingQuoteResult> {
    return this.repository.quote(userId, planId, promoCode);
  }

  createOrder(input: CreateBillingOrderInput): Promise<BillingOrderMutationResult> {
    return this.repository.createOrder(input);
  }

  getOrderByPublicId(userId: string, publicId: string): Promise<BillingOrderView> {
    return this.repository.getOrderByPublicId(userId, publicId);
  }

  verifyOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    return this.repository.verifyOrder(userId, publicId);
  }

  cancelOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    return this.repository.cancelOrder(userId, publicId);
  }

  createReplacementAttempt(userId: string, publicId: string): Promise<BillingOrderMutationResult> {
    return this.repository.createReplacementAttempt(userId, publicId);
  }

  persistVerifiedPayOSWebhook(input: VerifiedPayOSWebhookInput): Promise<PersistedWebhookResult> {
    return this.repository.persistVerifiedPayOSWebhook(input);
  }

  persistUnsupportedPayOSWebhook(rawPayloadHash: string): Promise<PersistedWebhookResult> {
    return this.repository.persistUnsupportedPayOSWebhook(rawPayloadHash);
  }

  processInbox(limit?: number): Promise<InboxProcessingResult> {
    return this.repository.processInbox(limit);
  }

  reconcileDueAttempts(limit?: number): Promise<ReconciliationResult> {
    return this.repository.reconcileDueAttempts(limit);
  }

  consumeInternalNonce(nonce: string, expiresAt: Date): Promise<void> {
    return this.repository.consumeInternalNonce(nonce, expiresAt);
  }

  listPromotions(): Promise<PromotionAdminView[]> {
    return this.repository.listPromotions();
  }

  createPromotion(input: CreatePromotionInput): Promise<PromotionAdminView> {
    return this.repository.createPromotion(input);
  }

  archivePromotion(id: string): Promise<PromotionAdminView> {
    return this.repository.archivePromotion(id);
  }

  recordExternalMoneyAdjustment(
    input: CreateExternalMoneyAdjustmentInput,
  ): Promise<BillingOrderView> {
    return this.repository.recordExternalMoneyAdjustment(input);
  }
}
