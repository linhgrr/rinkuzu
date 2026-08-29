import { describe, expect, it } from 'vitest';
import type {
  BillingPaymentProvider,
  ProviderCreateOutcome,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';
import { settleAttempt, type SettlementDeps } from '@/services/billing/settlement/settle-attempt';
import { fulfillOrder } from '@/services/billing/settlement/fulfill-order';
import {
  drainDueAttempts,
  drainFulfillmentBacklog,
  drainWebhookInbox,
} from '@/services/billing/settlement/drains';
import {
  FakeSettlementRepository,
  type FakeSettlementOptions,
} from '../../helpers/billing-settlement-double';

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);

function paidSnapshot(overrides: Partial<ProviderPaymentSnapshot> = {}): ProviderPaymentSnapshot {
  return {
    id: 'link-1',
    orderCode: 4242,
    amount: 100_000,
    amountPaid: 100_000,
    amountRemaining: 0,
    currency: 'VND',
    status: 'PAID',
    createdAt: '2026-07-01T11:00:00.000Z',
    transactions: [
      {
        reference: 'txn-1',
        amount: 100_000,
        transactionDateTime: '2026-07-01T11:30:00.000Z',
      },
    ],
    ...overrides,
  } as ProviderPaymentSnapshot;
}

class FakeProvider implements BillingPaymentProvider {
  readonly cancelled: number[] = [];
  constructor(private readonly snapshot: ProviderPaymentSnapshot | null) {}

  async createCheckout(): Promise<ProviderCreateOutcome> {
    throw new Error('not used');
  }

  async getPayment(): Promise<ProviderPaymentSnapshot | null> {
    return this.snapshot;
  }

  async cancelPayment(orderCode: number): Promise<ProviderPaymentSnapshot> {
    this.cancelled.push(orderCode);
    if (!this.snapshot) throw new Error('no snapshot');
    return this.snapshot;
  }
}

interface Harness {
  settlement: FakeSettlementRepository;
  deps: SettlementDeps;
}

function harness(
  snapshot: ProviderPaymentSnapshot | null,
  options: FakeSettlementOptions = {},
  autoActivation = true,
): Harness {
  const settlement = new FakeSettlementRepository(options);
  return {
    settlement,
    deps: {
      settlement,
      provider: new FakeProvider(snapshot),
      clock: () => NOW,
      random: () => 0.5,
      autoActivationEnabled: () => autoActivation,
    },
  };
}

const RECENT = NOW - 60_000;

function seedPayableOrder(settlement: FakeSettlementRepository): void {
  settlement.seedOrder({ orderRef: 'order-1', createdAtMs: RECENT });
  settlement.seedAttempt({ attemptRef: 'attempt-1', orderRef: 'order-1', createdAtMs: RECENT });
}

describe('settleAttempt', () => {
  it('records money and grants the entitlement exactly once', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    const result = await settleAttempt(deps, { attempt, origin: 'checkout_verify' });

    expect(result).toEqual({
      outcome: 'applied',
      fulfillmentArmed: true,
      origin: 'checkout_verify',
    });
    expect(settlement.orders.get('order-1')).toMatchObject({
      collectionStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      receivedMinor: 100_000,
      idempotencyCompleted: true,
    });
    expect(settlement.grants).toHaveLength(1);
    expect(settlement.promotionsConsumed).toEqual(['order-1']);
  });

  it('writes the same result whichever origin triggered it', async () => {
    const origins = ['checkout_verify', 'webhook', 'reconcile_cron'] as const;
    const observed = [];
    for (const origin of origins) {
      const { settlement, deps } = harness(paidSnapshot());
      seedPayableOrder(settlement);
      const attempt = await settlement.loadAttempt('attempt-1');
      if (!attempt) throw new Error('seeded attempt missing');
      const result = await settleAttempt(deps, { attempt, origin });
      observed.push({
        result: { ...result, origin: 'normalized' },
        order: settlement.orders.get('order-1'),
        attempt: settlement.attempts.get('attempt-1'),
        grants: settlement.grants.length,
      });
    }
    expect(observed[1]).toEqual(observed[0]);
    expect(observed[2]).toEqual(observed[0]);
  });

  it('keeps the money committed when the entitlement grant fails', async () => {
    const { settlement, deps } = harness(paidSnapshot(), { grantFailures: 1 });
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    await settleAttempt(deps, { attempt, origin: 'webhook' });

    const order = settlement.orders.get('order-1');
    expect(order).toMatchObject({ collectionStatus: 'paid', fulfillmentStatus: 'unfulfilled' });
    expect(settlement.grants).toHaveLength(0);
    // Rescheduled, not lost, and no longer leased.
    expect(order?.fulfillmentNextAttemptAtMs).toBeGreaterThan(NOW);
    expect(order?.fulfillmentLeaseUntilMs).toBeNull();
  });

  it('grants once when a retry follows a failed grant', async () => {
    const { settlement, deps } = harness(paidSnapshot(), { grantFailures: 1 });
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');
    await settleAttempt(deps, { attempt, origin: 'webhook' });

    const later: SettlementDeps = { ...deps, clock: () => NOW + 10 * 60_000 };
    await fulfillOrder(later, 'order-1');
    await fulfillOrder(later, 'order-1');

    expect(settlement.grants).toHaveLength(1);
    expect(settlement.orders.get('order-1')).toMatchObject({ fulfillmentStatus: 'fulfilled' });
  });

  it('sends an expected entitlement conflict to review with the money intact', async () => {
    const { BillingDomainError } = await import('@/services/billing/billing-domain');
    const { settlement, deps } = harness(paidSnapshot(), {
      grantFailures: 1,
      grantError: new BillingDomainError(
        'already_has_perpetual_entitlement',
        'Already entitled',
        409,
      ),
    });
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    await settleAttempt(deps, { attempt, origin: 'checkout_verify' });

    expect(settlement.orders.get('order-1')).toMatchObject({
      collectionStatus: 'paid',
      fulfillmentStatus: 'review',
      fulfillmentLastError: 'already_has_perpetual_entitlement',
      fulfillmentNextAttemptAtMs: null,
    });
    expect(settlement.grants).toHaveLength(0);
  });

  it('escalates an attempt whose provider snapshot breaks an invariant', async () => {
    const { settlement, deps } = harness(paidSnapshot({ amount: 1 }));
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    const result = await settleAttempt(deps, { attempt, origin: 'reconcile_cron' });

    expect(result.outcome).toBe('escalated');
    expect(settlement.attempts.get('attempt-1')).toMatchObject({
      collectionStatus: 'review',
      escalationReason: 'provider_invariant_mismatch',
      // An escalated attempt leaves the automatic queue instead of being
      // re-selected on every tick.
      nextReconcileAtMs: null,
    });
  });

  it('applies late money that lands on an already cancelled attempt', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    settlement.seedOrder({ orderRef: 'order-1', createdAtMs: RECENT });
    settlement.seedAttempt({
      attemptRef: 'attempt-1',
      createdAtMs: RECENT,
      orderRef: 'order-1',
      collectionStatus: 'cancelled',
      activeForCheckout: false,
      settledAtMs: NOW - 3_600_000,
      nextReconcileAtMs: NOW - 60_000,
    });
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    const result = await settleAttempt(deps, { attempt, origin: 'reconcile_cron' });

    expect(result.outcome).toBe('applied');
    expect(settlement.attempts.get('attempt-1')?.collectionStatus).toBe('paid');
    expect(settlement.orders.get('order-1')).toMatchObject({ fulfillmentStatus: 'fulfilled' });
  });

  it('reschedules instead of writing anything when the provider is unavailable', async () => {
    const { settlement, deps } = harness(null);
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    const result = await settleAttempt(deps, { attempt, origin: 'reconcile_cron' });

    expect(result.outcome).toBe('provider_unavailable');
    expect(settlement.attempts.get('attempt-1')?.nextReconcileAtMs).toBeGreaterThan(NOW);
    expect(settlement.orders.get('order-1')?.collectionStatus).toBe('unpaid');
  });

  it('parks the money for manual activation instead of granting when activation is off', async () => {
    const { settlement, deps } = harness(paidSnapshot(), {}, false);
    seedPayableOrder(settlement);
    const attempt = await settlement.loadAttempt('attempt-1');
    if (!attempt) throw new Error('seeded attempt missing');

    await settleAttempt(deps, { attempt, origin: 'webhook' });

    const order = settlement.orders.get('order-1');
    expect(order).toMatchObject({ collectionStatus: 'paid', fulfillmentStatus: 'processing' });
    expect(settlement.grants).toHaveLength(0);
    // Parked, not abandoned, and it did not spend the poison-order budget.
    expect(order?.fulfillmentNextAttemptAtMs).toBeGreaterThan(NOW);
    expect(order?.fulfillmentAttemptCount).toBe(0);
  });
});

describe('fulfillment leases', () => {
  it('refuses a second worker while the first still holds the lease', async () => {
    const { settlement, deps } = harness(paidSnapshot(), { grantFailures: 1 });
    seedPayableOrder(settlement);
    const order = settlement.orders.get('order-1');
    if (!order) throw new Error('seeded order missing');
    order.collectionStatus = 'paid';
    order.receivedMinor = order.finalMinor;
    order.netPrincipalMinor = order.finalMinor;
    order.settlementStatus = 'settled';
    order.fulfillmentNextAttemptAtMs = NOW;

    const claim = await settlement.inFulfillmentTransaction('order-1', (tx) =>
      tx.claim({ orderRef: 'order-1', nowMs: NOW, leaseMs: 60_000 }),
    );
    expect(claim).not.toBeNull();

    const result = await fulfillOrder(deps, 'order-1');
    expect(result).toEqual({ outcome: 'not_claimable', reason: null });
  });

  it('lets the next worker reclaim the order once the lease has expired', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    seedPayableOrder(settlement);
    const order = settlement.orders.get('order-1');
    if (!order) throw new Error('seeded order missing');
    order.collectionStatus = 'paid';
    order.receivedMinor = order.finalMinor;
    order.netPrincipalMinor = order.finalMinor;
    order.settlementStatus = 'settled';
    order.fulfillmentNextAttemptAtMs = NOW - 120_000;
    order.fulfillmentLeaseUntilMs = NOW - 1;

    const result = await fulfillOrder(deps, 'order-1');

    expect(result.outcome).toBe('granted');
    expect(settlement.grants).toHaveLength(1);
  });
});

describe('drains', () => {
  it('keeps working after an order that cannot even record its own failure', async () => {
    const settlement = new FakeSettlementRepository({ poisonOrderRefs: ['poison'] });
    const deps: SettlementDeps = {
      settlement,
      provider: new FakeProvider(paidSnapshot()),
      clock: () => NOW,
      random: () => 0.5,
      autoActivationEnabled: () => true,
    };
    settlement.seedOrder({
      orderRef: 'poison',
      collectionStatus: 'paid',
      receivedMinor: 100_000,
      settlementStatus: 'settled',
      fulfillmentNextAttemptAtMs: NOW - 60_000,
    });
    settlement.seedOrder({
      orderRef: 'healthy',
      collectionStatus: 'paid',
      receivedMinor: 100_000,
      settlementStatus: 'settled',
      fulfillmentNextAttemptAtMs: NOW - 30_000,
    });

    const result = await drainFulfillmentBacklog(deps, { limit: 10, budgetMs: 60_000 });

    // The poison order threw before its claim committed, so it was never
    // claimed and must not be reported as though it had been.
    expect(result.claimed).toBe(1);
    expect(result.granted).toBe(1);
    expect(settlement.orders.get('healthy')).toMatchObject({ fulfillmentStatus: 'fulfilled' });
    expect(settlement.orders.get('poison')).toMatchObject({ fulfillmentStatus: 'unfulfilled' });
  });

  it('never selects an attempt an operator owns', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    settlement.seedOrder({ orderRef: 'order-1' });
    settlement.seedAttempt({
      attemptRef: 'escalated',
      orderRef: 'order-1',
      collectionStatus: 'review',
      nextReconcileAtMs: NOW - 60_000,
    });

    const result = await drainDueAttempts(deps, { limit: 10, budgetMs: 60_000 });

    expect(result.processed).toBe(0);
    expect(settlement.attempts.get('escalated')?.collectionStatus).toBe('review');
  });

  it('parks a webhook with no usable order code instead of failing the batch', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    seedPayableOrder(settlement);
    settlement.seedInboxEvent({ inboxRef: 'inbox-bad', orderCode: null, createdAtMs: RECENT });
    settlement.seedInboxEvent({
      inboxRef: 'inbox-good',
      orderCode: 4242,
      nextAttemptAtMs: 1,
      createdAtMs: RECENT,
    });

    const result = await drainWebhookInbox(deps, { limit: 10, budgetMs: 60_000 });

    expect(result.claimed).toBe(2);
    expect(result.processed).toBe(1);
    expect(settlement.inbox.find((event) => event.inboxRef === 'inbox-bad')?.status).toBe(
      'retryable_failure',
    );
    expect(settlement.inbox.find((event) => event.inboxRef === 'inbox-good')?.status).toBe(
      'processed',
    );
    expect(settlement.orders.get('order-1')).toMatchObject({ fulfillmentStatus: 'fulfilled' });
  });

  it('orphans a webhook whose order is not known yet and retries it later', async () => {
    const { settlement, deps } = harness(paidSnapshot());
    settlement.seedInboxEvent({ inboxRef: 'inbox-orphan', orderCode: 9999, createdAtMs: RECENT });

    const result = await drainWebhookInbox(deps, { limit: 10, budgetMs: 60_000 });

    expect(result.claimed).toBe(1);
    expect(result.processed).toBe(0);
    const event = settlement.inbox[0];
    expect(event?.status).toBe('orphaned');
    expect(event?.nextAttemptAtMs).toBeGreaterThan(NOW);
  });
});
