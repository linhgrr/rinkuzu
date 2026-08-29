import { describe, expect, it } from 'vitest';
import type {
  BillingPaymentProvider,
  ProviderCreateOutcome,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';
import type { SettlementDeps } from '@/services/billing/settlement/settle-attempt';
import { fulfillOrder } from '@/services/billing/settlement/fulfill-order';
import {
  FakeSettlementRepository,
  type FakeOrder,
  type FakeSettlementOptions,
} from '../../helpers/billing-settlement-double';

/**
 * How long a failing order is chased, and from when.
 *
 * Both numbers here are promises to a customer who has already paid: the tenth
 * failure is the one that hands the order to an operator, and the backoff ages
 * from the moment the order became payable rather than from whenever the first
 * coin arrived. An order part-paid in the spring and completed today is a
 * fresh work item, and chasing it on the six-hour heartbeat reserved for
 * day-old work would leave that customer waiting for no reason.
 */

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const SIX_MONTHS_MS = 182 * 86_400_000;
const ORDER = 'order-1';

/** Pinned locally: this suite exists to fail when the policy moves. */
const MAX_FULFILLMENT_ATTEMPTS = 10;
const FIRST_RETRY_DELAY_MS = 60_000;
const DAY_OLD_RETRY_DELAY_MS = 6 * 60 * 60_000;

class UnusedProvider implements BillingPaymentProvider {
  async createCheckout(): Promise<ProviderCreateOutcome> {
    throw new Error('not used');
  }

  async getPayment(): Promise<ProviderPaymentSnapshot | null> {
    throw new Error('not used');
  }

  async cancelPayment(): Promise<ProviderPaymentSnapshot> {
    throw new Error('not used');
  }
}

interface Harness {
  settlement: FakeSettlementRepository;
  deps: SettlementDeps;
  setNow: (atMs: number) => void;
}

/** Every grant fails, so each pass is one failed fulfillment attempt. */
function failingHarness(options: FakeSettlementOptions = {}): Harness {
  const settlement = new FakeSettlementRepository({
    grantFailures: Number.MAX_SAFE_INTEGER,
    grantError: new Error('entitlement ledger unavailable'),
    ...options,
  });
  let nowMs = NOW;
  return {
    settlement,
    setNow: (atMs) => {
      nowMs = atMs;
    },
    deps: {
      settlement,
      provider: new UnusedProvider(),
      clock: () => nowMs,
      // A pinned jitter of 0.5 leaves the ladder value untouched, so the due
      // times below are exact rather than a range.
      random: () => 0.5,
      autoActivationEnabled: () => true,
    },
  };
}

function seedCollected(settlement: FakeSettlementRepository, overrides: Partial<FakeOrder>): void {
  settlement.seedOrder({
    orderRef: ORDER,
    collectionStatus: 'paid',
    // Paid in full and nothing given back, so the order is entitled: the
    // fulfillment claim fences on net settlement, not on the collection status.
    receivedMinor: 100_000,
    netPrincipalMinor: 100_000,
    settlementStatus: 'settled',
    createdAtMs: NOW - 60_000,
    fullyCollectedAtMs: NOW - 60_000,
    fulfillmentNextAttemptAtMs: NOW - 1_000,
    ...overrides,
  });
}

function requireOrder(settlement: FakeSettlementRepository): FakeOrder {
  const order = settlement.orders.get(ORDER);
  if (!order) throw new Error('seeded order missing');
  return order;
}

describe('the attempt ceiling', () => {
  it('hands the order to an operator on exactly the tenth failure', async () => {
    const { settlement, deps, setNow } = failingHarness();
    seedCollected(settlement, {});

    const outcomes: string[] = [];
    for (let pass = 0; pass < MAX_FULFILLMENT_ATTEMPTS + 2; pass += 1) {
      const result = await fulfillOrder(deps, ORDER);
      outcomes.push(result.outcome);
      if (result.outcome === 'review') break;
      // Wake up when the order says it is due again, so the loop counts
      // attempts rather than depending on a clock that never moves.
      const dueAtMs = requireOrder(settlement).fulfillmentNextAttemptAtMs;
      if (dueAtMs === null) break;
      setNow(dueAtMs);
    }

    expect(outcomes).toHaveLength(MAX_FULFILLMENT_ATTEMPTS);
    expect(outcomes.slice(0, -1).every((outcome) => outcome === 'rescheduled')).toBe(true);
    expect(outcomes.at(-1)).toBe('review');
    expect(requireOrder(settlement)).toMatchObject({
      fulfillmentStatus: 'review',
      fulfillmentLastError: 'fulfillment_attempts_exhausted',
      fulfillmentAttemptCount: MAX_FULFILLMENT_ATTEMPTS,
      fulfillmentNextAttemptAtMs: null,
    });
  });

  it('still retries on the ninth failure', async () => {
    const { settlement, deps } = failingHarness();
    seedCollected(settlement, { fulfillmentAttemptCount: MAX_FULFILLMENT_ATTEMPTS - 2 });

    const result = await fulfillOrder(deps, ORDER);

    expect(result.outcome).toBe('rescheduled');
    expect(requireOrder(settlement).fulfillmentAttemptCount).toBe(MAX_FULFILLMENT_ATTEMPTS - 1);
  });

  it('stops on the tenth failure', async () => {
    const { settlement, deps } = failingHarness();
    seedCollected(settlement, { fulfillmentAttemptCount: MAX_FULFILLMENT_ATTEMPTS - 1 });

    const result = await fulfillOrder(deps, ORDER);

    expect(result).toEqual({ outcome: 'review', reason: 'fulfillment_attempts_exhausted' });
  });
});

describe('the backoff origin', () => {
  it('ages an order completed today from today, not from its first deposit', async () => {
    const { settlement, deps } = failingHarness();
    seedCollected(settlement, {
      // Ordered and part-paid six months ago; the balance arrived a minute ago.
      createdAtMs: NOW - SIX_MONTHS_MS,
      providerPaidAtMs: NOW - SIX_MONTHS_MS,
      fullyCollectedAtMs: NOW - 60_000,
    });

    await fulfillOrder(deps, ORDER);

    expect(requireOrder(settlement).fulfillmentNextAttemptAtMs).toBe(NOW + FIRST_RETRY_DELAY_MS);
  });

  it('keeps the cheap heartbeat for an order that has been payable for a day', async () => {
    const { settlement, deps } = failingHarness();
    seedCollected(settlement, {
      createdAtMs: NOW - SIX_MONTHS_MS,
      providerPaidAtMs: NOW - SIX_MONTHS_MS,
      fullyCollectedAtMs: NOW - 2 * 86_400_000,
    });

    await fulfillOrder(deps, ORDER);

    expect(requireOrder(settlement).fulfillmentNextAttemptAtMs).toBe(NOW + DAY_OLD_RETRY_DELAY_MS);
  });

  it('dates the completion once and never moves it', async () => {
    const { settlement } = failingHarness();
    seedCollected(settlement, { fullyCollectedAtMs: null, collectionStatus: 'partial' });

    const observe = (atMs: number): Promise<void> =>
      settlement.inSettlementTransaction((tx) =>
        tx.applyOrderCollection({
          orderRef: ORDER,
          receivedMinor: 100_000,
          excessMinor: 0,
          netPrincipalMinor: 100_000,
          settlementStatus: 'settled',
          excessResolution: 'none',
          collectionStatus: 'paid',
          providerPaidAtMs: NOW - SIX_MONTHS_MS,
          fullyCollectedAtMs: atMs,
        }),
      );

    await observe(NOW);
    // A webhook and the reconciliation cron both see the same completed order.
    await observe(NOW + 3_600_000);

    expect(requireOrder(settlement).fullyCollectedAtMs).toBe(NOW);
  });
});
