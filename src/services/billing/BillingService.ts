import type {
  BillingOrderView,
  IBillingOrderRepository,
} from '@/interfaces/repositories/IBillingOrderRepository';
import type { IBillingPromotionRepository } from '@/interfaces/repositories/IBillingPromotionRepository';
import type { IBillingSettlementRepository } from '@/interfaces/repositories/IBillingSettlementRepository';
import type { BillingPaymentProvider } from './payos-adapter';
import { billingConfig } from './billing-config';
import {
  drainDueAttempts,
  drainFulfillmentBacklog,
  drainWebhookInbox,
  DEFAULT_BATCH_LIMIT,
  DEFAULT_BATCH_BUDGET_MS,
  FULFILLMENT_BUDGET_RESERVE,
  type AttemptDrainResult,
  type DrainOptions,
  type InboxDrainResult,
} from './settlement/drains';
import { settleAttempt, type SettlementDeps } from './settlement/settle-attempt';

/**
 * Everything that settles money, and nothing else.
 *
 * Quoting, opening an order, promotions and adjustments each have their own
 * port and their own caller; routing them through here bought nothing but a
 * second name for the same call, and made the one place that genuinely
 * composes behaviour — the settlement handlers — hard to find among the
 * forwarding. What is left is the four operations that actually assemble
 * something: the two the customer triggers and the two the scheduler does.
 */
export class BillingService {
  private readonly settlementDeps: SettlementDeps;

  constructor(
    private readonly orders: IBillingOrderRepository,
    private readonly settlement: IBillingSettlementRepository,
    private readonly promotions: IBillingPromotionRepository,
    provider: BillingPaymentProvider,
    clock: () => number = Date.now,
    random: () => number = Math.random,
  ) {
    this.settlementDeps = {
      settlement,
      provider,
      clock,
      random,
      autoActivationEnabled: () => billingConfig.entitlementAutoActivationEnabled(),
    };
  }

  /**
   * Settles the order's latest attempt against the provider, then returns the
   * order as it now stands. An order with no attempt yet has nothing to settle.
   */
  async verifyOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    const attempt = await this.settlement.findLatestAttemptForOwnedOrder({ userId, publicId });
    if (attempt) {
      await settleAttempt(this.settlementDeps, { attempt, origin: 'checkout_verify' });
    }
    return this.orders.getOrderByPublicId(userId, publicId);
  }

  /**
   * Cancels at the provider first, then settles: the provider is the authority
   * on whether the attempt is cancelled, and settling afterwards records that
   * verdict through the same path every other observation takes.
   */
  async cancelOrder(userId: string, publicId: string): Promise<BillingOrderView> {
    const attempt = await this.settlement.findCancellableAttempt({ userId, publicId });
    await this.settlementDeps.provider.cancelPayment(
      Number(attempt.externalOrderId),
      'User requested cancellation',
    );
    await settleAttempt(this.settlementDeps, { attempt, origin: 'checkout_verify' });
    return this.orders.getOrderByPublicId(userId, publicId);
  }

  /**
   * Drains the webhook inbox and the fulfillment backlog in one tick, with the
   * tail of the budget reserved for fulfillment before the inbox starts.
   *
   * Leftovers are not a scheduling policy. A busy site produces webhooks faster
   * than one tick can drain them, and an inbox allowed to spend the whole
   * budget leaves every paid-but-unfulfilled customer at zero service for as
   * long as the traffic lasts — indefinitely, in the worst case. Reserving the
   * share up front bounds the inbox instead, so the queue holding customers who
   * have already paid is served on every tick regardless of inbox volume.
   */
  async processInbox(options: DrainOptions = {}): Promise<InboxDrainResult> {
    const budgetMs = options.budgetMs ?? DEFAULT_BATCH_BUDGET_MS;
    const startedAtMs = this.settlementDeps.clock();
    const reserveMs = Math.floor(budgetMs * FULFILLMENT_BUDGET_RESERVE);
    const inbox = await drainWebhookInbox(this.settlementDeps, {
      ...options,
      budgetMs: budgetMs - reserveMs,
    });
    // The reserve is a floor on fulfillment's share and not a ceiling: what
    // the inbox leaves unspent is fulfillment's too, and a single inbox item
    // that overruns the whole tick still cannot take the floor away. Such an
    // item overruns the budget on its own account; it must not also be able to
    // decide that nobody who has paid gets served.
    const elapsedMs = this.settlementDeps.clock() - startedAtMs;
    const fulfillment = await drainFulfillmentBacklog(this.settlementDeps, {
      limit: options.limit ?? DEFAULT_BATCH_LIMIT,
      budgetMs: Math.max(budgetMs - elapsedMs, reserveMs),
    });
    return {
      ...inbox,
      exhaustedBudget: inbox.exhaustedBudget || fulfillment.exhaustedBudget,
    };
  }

  /**
   * Reconciles due attempts, then releases promotion reservations that their
   * order can no longer redeem. Both are counted as processed work, which is
   * what the scheduler reports.
   */
  async reconcileDueAttempts(options: DrainOptions = {}): Promise<AttemptDrainResult> {
    const result = await drainDueAttempts(this.settlementDeps, options);
    const released = await this.promotions.releaseDuePromotionReservations(
      options.limit ?? DEFAULT_BATCH_LIMIT,
    );
    return { ...result, processed: result.processed + released };
  }
}
