import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IBillingOrderRepository } from '@/interfaces/repositories/IBillingOrderRepository';
import type { IBillingPromotionRepository } from '@/interfaces/repositories/IBillingPromotionRepository';
import type {
  BillingPaymentProvider,
  ProviderCreateOutcome,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';
import type {
  FulfillmentWork,
  OrderRef,
} from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingService } from '@/services/billing/BillingService';
import { drainDueAttempts } from '@/services/billing/settlement/drains';
import type { SettlementDeps } from '@/services/billing/settlement/settle-attempt';
import { FakeSettlementRepository } from '../../helpers/billing-settlement-double';

/**
 * How one tick of the scheduler is divided between the two queues it drains.
 *
 * The inbox and the fulfillment backlog are not equally urgent to the same
 * people. An inbox row is money that has not been recorded yet; a fulfillment
 * row is money already taken from a customer who is still waiting for what
 * they bought. Spending the tick on the inbox and giving fulfillment the
 * remainder means that, for as long as webhooks arrive faster than one tick
 * can drain them, the customers who have already paid get nothing — not
 * slowly, but never. These tests pin the share that cannot be taken from them.
 */

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const BUDGET_MS = 45_000;

/**
 * `processInbox` settles money and fulfills orders; it has no business reading
 * an order or touching a promotion, so the ports it is handed here refuse every
 * call instead of pretending to be repositories.
 */
function unusablePort<T extends object>(label: string): T {
  return new Proxy({} as T, {
    get(_target, property): never {
      throw new Error(`processInbox must not call ${label}.${String(property)}`);
    },
  });
}

/**
 * A provider whose every call costs wall-clock time, which is what makes the
 * inbox the expensive queue: each webhook is settled against one round trip.
 */
class SlowProvider implements BillingPaymentProvider {
  constructor(
    private readonly advance: (byMs: number) => void,
    private readonly costMs: number,
  ) {}

  async createCheckout(): Promise<ProviderCreateOutcome> {
    throw new Error('not used');
  }

  async getPayment(orderCode: number): Promise<ProviderPaymentSnapshot | null> {
    this.advance(this.costMs);
    return {
      id: `link-${orderCode}`,
      orderCode,
      amount: 100_000,
      amountPaid: 100_000,
      amountRemaining: 0,
      currency: 'VND',
      status: 'PAID',
      createdAt: '2026-07-01T11:00:00.000Z',
      transactions: [
        {
          reference: `txn-${orderCode}`,
          amount: 100_000,
          transactionDateTime: '2026-07-01T11:30:00.000Z',
        },
      ],
    } as ProviderPaymentSnapshot;
  }

  async cancelPayment(): Promise<ProviderPaymentSnapshot> {
    throw new Error('not used');
  }
}

/**
 * Fulfillment is database-only and cheap, but not free. Charging the tick for
 * each of its commits is what makes a budget mean anything here: with free
 * work, any budget at all — even none — drains the whole backlog, and the
 * share a policy hands out stops being observable.
 */
class TimedSettlementRepository extends FakeSettlementRepository {
  constructor(
    private readonly charge: (byMs: number) => void,
    private readonly costMs: number,
  ) {
    super();
  }

  override inFulfillmentTransaction<T>(orderRef: OrderRef, work: FulfillmentWork<T>): Promise<T> {
    this.charge(this.costMs);
    return super.inFulfillmentTransaction(orderRef, work);
  }
}

/** Two commits per order — the claim and the grant — at this cost each. */
const FULFILLMENT_COMMIT_MS = 5_000;

interface Harness {
  settlement: FakeSettlementRepository;
  service: BillingService;
}

function harness(providerCostMs: number): Harness {
  let nowMs = NOW;
  const advance = (byMs: number): void => {
    nowMs += byMs;
  };
  const settlement = new TimedSettlementRepository(advance, FULFILLMENT_COMMIT_MS);
  const provider = new SlowProvider(advance, providerCostMs);
  return {
    settlement,
    service: new BillingService(
      unusablePort<IBillingOrderRepository>('orders'),
      settlement,
      unusablePort<IBillingPromotionRepository>('promotions'),
      provider,
      () => nowMs,
      () => 0.5,
    ),
  };
}

/** A webhook waiting to be settled, with the attempt and order behind it. */
function seedInboxWork(settlement: FakeSettlementRepository, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const orderCode = 1_000 + index;
    settlement.seedOrder({ orderRef: `inbox-order-${index}`, createdAtMs: NOW - 60_000 });
    settlement.seedAttempt({
      attemptRef: `inbox-attempt-${index}`,
      orderRef: `inbox-order-${index}`,
      externalOrderId: orderCode.toString(),
      createdAtMs: NOW - 60_000,
    });
    settlement.seedInboxEvent({ inboxRef: `inbox-${index}`, orderCode, createdAtMs: NOW - 60_000 });
  }
}

/** An order whose money is recorded and which is waiting to be granted. */
function seedFulfillmentWork(settlement: FakeSettlementRepository, count: number): void {
  for (let index = 0; index < count; index += 1) {
    settlement.seedOrder({
      orderRef: `paid-order-${index}`,
      userRef: `user-${index}`,
      collectionStatus: 'paid',
      receivedMinor: 100_000,
      settlementStatus: 'settled',
      createdAtMs: NOW - 60_000,
      fullyCollectedAtMs: NOW - 60_000,
      fulfillmentNextAttemptAtMs: NOW - 1_000,
    });
  }
}

function grantsFor(settlement: FakeSettlementRepository, prefix: string): number {
  return settlement.grants.filter((grant) => grant.orderRef.startsWith(prefix)).length;
}

describe('processInbox budget sharing', () => {
  beforeEach(() => {
    vi.stubEnv('ENTITLEMENT_AUTO_ACTIVATION_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves paid customers even when a single webhook eats the whole tick', async () => {
    // One webhook that overruns the entire budget on its own. Handing the
    // inbox the whole tick and fulfillment the leftover would leave nothing.
    const { settlement, service } = harness(BUDGET_MS + 5_000);
    seedInboxWork(settlement, 4);
    seedFulfillmentWork(settlement, 3);

    const result = await service.processInbox({ limit: 25, budgetMs: BUDGET_MS });

    expect(result.processed).toBe(1);
    expect(result.exhaustedBudget).toBe(true);
    // The reserve is a floor, so the overrun costs fulfillment nothing it was
    // promised: 15s of reserve buys two of the three waiting orders. On the
    // leftover policy the tick was already spent and it buys none.
    expect(grantsFor(settlement, 'paid-order-')).toBe(2);
  });

  it('serves paid customers under a continuously saturated inbox', async () => {
    // Each webhook costs a third of the tick, so the inbox could fill it.
    const { settlement, service } = harness(15_000);
    seedInboxWork(settlement, 25);
    seedFulfillmentWork(settlement, 5);

    const result = await service.processInbox({ limit: 25, budgetMs: BUDGET_MS });

    // The inbox stops at its own share rather than running to the deadline,
    // which leaves fulfillment 30s of the tick and four of the five orders.
    expect(result.processed).toBe(1);
    expect(result.exhaustedBudget).toBe(true);
    expect(grantsFor(settlement, 'paid-order-')).toBe(4);
  });

  it('keeps draining the inbox when the fulfillment backlog is saturated', async () => {
    const { settlement, service } = harness(1_000);
    seedInboxWork(settlement, 5);
    seedFulfillmentWork(settlement, 500);

    const result = await service.processInbox({ limit: 25, budgetMs: BUDGET_MS });

    // The inbox runs first and within its own share, so a backlog of any size
    // behind it cannot push webhook settlement off the tick.
    expect(result.claimed).toBe(5);
    expect(result.processed).toBe(5);
  });

  it('stops claiming webhooks once it has spent its share of the tick', async () => {
    // Ten seconds a webhook against a 45s tick: the inbox may spend 30s, and
    // it stops one round trip short of that, so exactly two are settled. With
    // the whole tick to spend it would have taken a third.
    const { settlement, service } = harness(10_000);
    seedInboxWork(settlement, 25);

    const result = await service.processInbox({ limit: 25, budgetMs: BUDGET_MS });

    expect(result.processed).toBe(2);
    expect(result.exhaustedBudget).toBe(true);
  });
});

/**
 * A lease says "someone is working on this right now". A tick that leases a
 * whole batch and then stops at its budget leaves that claim on every row it
 * never reached — held out of the queue, for the full lease duration, by a
 * worker that has already gone home. The work the tick could not do was
 * invisible to the next one, which is the opposite of what a bounded batch is
 * for.
 */
describe('the reconciliation drain claims only what it will work on', () => {
  function attemptHarness(providerCostMs: number, dueCount: number) {
    let nowMs = NOW;
    const advance = (byMs: number): void => {
      nowMs += byMs;
    };
    const settlement = new FakeSettlementRepository();
    for (let index = 0; index < dueCount; index += 1) {
      settlement.seedOrder({ orderRef: `due-order-${index}`, createdAtMs: NOW - 60_000 });
      settlement.seedAttempt({
        attemptRef: `due-attempt-${index}`,
        orderRef: `due-order-${index}`,
        externalOrderId: String(2_000 + index),
        createdAtMs: NOW - 60_000,
        // Staggered so the selection order is deterministic.
        nextReconcileAtMs: NOW - 60_000 + index,
      });
    }
    const deps: SettlementDeps = {
      settlement,
      provider: new SlowProvider(advance, providerCostMs),
      clock: () => nowMs,
      random: () => 0.5,
      autoActivationEnabled: () => false,
    };
    return { settlement, deps };
  }

  function leasedCount(settlement: FakeSettlementRepository): number {
    return [...settlement.attempts.values()].filter(
      (attempt) => attempt.reconcileLeaseToken !== null,
    ).length;
  }

  it('leaves the work it could not reach immediately claimable by the next tick', async () => {
    // Ten seconds a round trip against a 45s budget that keeps a 16s reserve
    // for the call in flight: three attempts get worked. The other seven must
    // be untouched.
    const { settlement, deps } = attemptHarness(10_000, 10);

    const result = await drainDueAttempts(deps, { limit: 25, budgetMs: BUDGET_MS });

    expect(result.processed).toBe(3);
    expect(result.exhaustedBudget).toBe(true);
    // Nothing is left holding a lease: each processed attempt released its own
    // on the transition that settled it, and the rest were never claimed.
    expect(leasedCount(settlement)).toBe(0);
    const untouched = [...settlement.attempts.values()].filter(
      (attempt) => attempt.collectionStatus === 'pending',
    );
    expect(untouched).toHaveLength(7);
    for (const attempt of untouched) {
      expect(attempt.reconcileLeaseUntilMs).toBeNull();
      expect(attempt.nextReconcileAtMs).toBeLessThanOrEqual(NOW);
    }
  });

  it('does not spend the batch limit on rows it has no budget for', async () => {
    const { settlement, deps } = attemptHarness(60_000, 5);

    const result = await drainDueAttempts(deps, { limit: 25, budgetMs: BUDGET_MS });

    // One attempt fits; the budget check happens before the claim, so nothing
    // else is even selected.
    expect(result.processed).toBe(1);
    expect(leasedCount(settlement)).toBe(0);
  });

  it('stops cleanly when the queue is empty rather than burning the budget', async () => {
    const { settlement, deps } = attemptHarness(1_000, 3);

    const result = await drainDueAttempts(deps, { limit: 25, budgetMs: BUDGET_MS });

    expect(result).toEqual({ processed: 3, failed: 0, exhaustedBudget: false });
    expect(leasedCount(settlement)).toBe(0);
  });
});
