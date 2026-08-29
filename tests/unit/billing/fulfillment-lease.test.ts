import { describe, expect, it } from 'vitest';
import type {
  BillingPaymentProvider,
  ProviderCreateOutcome,
  ProviderPaymentSnapshot,
} from '@/services/billing/payos-adapter';
import type { SettlementDeps } from '@/services/billing/settlement/settle-attempt';
import { fulfillOrder } from '@/services/billing/settlement/fulfill-order';
import { FULFILLMENT_LEASE_MS } from '@/services/billing/domain/schedule';
import {
  FakeSettlementRepository,
  type FakeSettlementOptions,
} from '../../helpers/billing-settlement-double';

/**
 * A lease is only worth having if the writes that follow it can be refused.
 *
 * These are the two-worker races: a worker whose lease expired mid-flight is
 * still holding a claim it believes in, and everything it does afterwards —
 * finishing, giving up, rescheduling, releasing — would otherwise land on an
 * order that now belongs to someone else. The expired worker must lose every
 * one of those writes, and the state left by the worker that reclaimed the
 * order must survive untouched.
 */

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const ORDER = 'order-1';

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
}

function harness(nowMs: () => number = () => NOW, options: FakeSettlementOptions = {}): Harness {
  const settlement = new FakeSettlementRepository(options);
  return {
    settlement,
    deps: {
      settlement,
      provider: new UnusedProvider(),
      clock: nowMs,
      random: () => 0.5,
      autoActivationEnabled: () => true,
    },
  };
}

function seedPayable(settlement: FakeSettlementRepository): void {
  settlement.seedOrder({
    orderRef: ORDER,
    collectionStatus: 'paid',
    // Paid in full with nothing given back: the fulfillment claim fences on net
    // settlement, so an order that is merely collected is not enough.
    receivedMinor: 100_000,
    settlementStatus: 'settled',
    fullyCollectedAtMs: NOW - 60_000,
    createdAtMs: NOW - 60_000,
    fulfillmentNextAttemptAtMs: NOW - 1_000,
  });
}

function claimAt(settlement: FakeSettlementRepository, nowMs: number) {
  return settlement.inFulfillmentTransaction(ORDER, (tx) =>
    tx.claim({ orderRef: ORDER, nowMs, leaseMs: FULFILLMENT_LEASE_MS }),
  );
}

describe('lease exclusivity', () => {
  it('refuses a second claim while the first lease is live', async () => {
    const { settlement } = harness();
    seedPayable(settlement);

    const first = await claimAt(settlement, NOW);
    const second = await claimAt(settlement, NOW + FULFILLMENT_LEASE_MS - 1);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('hands the order to a new worker with a different token once the lease lapses', async () => {
    const { settlement } = harness();
    seedPayable(settlement);

    const workerA = await claimAt(settlement, NOW);
    const workerB = await claimAt(settlement, NOW + FULFILLMENT_LEASE_MS + 1);

    if (!workerA || !workerB) throw new Error('both claims should have succeeded');
    expect(workerB.lease.token).not.toBe(workerA.lease.token);
    // The reclaim counts as an attempt of its own: a worker that died holding
    // the lease still burned one, or a poison order would retry forever.
    expect(workerB.attemptCount).toBe(workerA.attemptCount + 1);
  });
});

describe('a worker whose lease was reclaimed', () => {
  it('cannot undo the state the reclaiming worker committed', async () => {
    const { settlement, deps } = harness();
    seedPayable(settlement);

    // Worker A claims, then stalls long enough for its lease to lapse.
    const workerA = await claimAt(settlement, NOW);
    if (!workerA) throw new Error('worker A should have claimed the order');

    // Worker B reclaims the order and fulfills it.
    const reclaimedAtMs = NOW + FULFILLMENT_LEASE_MS + 1;
    const workerBResult = await fulfillOrder({ ...deps, clock: () => reclaimedAtMs }, ORDER);
    expect(workerBResult.outcome).toBe('granted');

    // Worker A wakes up and tries to record the verdict it was working on.
    const review = await settlement.inFulfillmentTransaction(ORDER, (tx) =>
      tx.markForReview({ lease: workerA.lease, reason: 'fulfillment_attempts_exhausted' }),
    );
    const rescheduled = await settlement.inFulfillmentTransaction(ORDER, (tx) =>
      tx.reschedule({ lease: workerA.lease, dueAtMs: NOW + 600_000, lastError: 'stale worker' }),
    );
    const released = await settlement.inFulfillmentTransaction(ORDER, (tx) =>
      tx.releaseLease(workerA.lease),
    );
    const deferred = await settlement.inFulfillmentTransaction(ORDER, (tx) =>
      tx.deferForManualActivation({ lease: workerA.lease, recheckAtMs: NOW + 3_600_000 }),
    );

    expect([review, rescheduled, released, deferred]).toEqual([
      'lease_lost',
      'lease_lost',
      'lease_lost',
      'lease_lost',
    ]);
    expect(settlement.orders.get(ORDER)).toMatchObject({
      fulfillmentStatus: 'fulfilled',
      fulfilledAtMs: reclaimedAtMs,
      fulfillmentNextAttemptAtMs: null,
      fulfillmentLastError: null,
    });
    expect(settlement.grants).toHaveLength(1);
  });

  it('cannot grant a second entitlement on top of the fulfilled order', async () => {
    const { settlement, deps } = harness();
    seedPayable(settlement);

    const workerA = await claimAt(settlement, NOW);
    if (!workerA) throw new Error('worker A should have claimed the order');
    await fulfillOrder({ ...deps, clock: () => NOW + FULFILLMENT_LEASE_MS + 1 }, ORDER);

    await expect(
      settlement.inFulfillmentTransaction(ORDER, async (tx) => {
        await tx.grantEntitlement({
          orderRef: ORDER,
          userRef: 'user-1',
          planId: 'plan-premium',
          planName: 'Premium',
          durationUnit: 'month',
          durationValue: 1,
          committedAtMs: NOW,
          providerPaidAtMs: null,
        });
        await tx.markFulfilled({ lease: workerA.lease, fulfilledAtMs: NOW });
      }),
    ).rejects.toMatchObject({ code: 'fulfillment_lease_lost' });

    // The rejected commit took its own grant with it.
    expect(settlement.grants).toHaveLength(1);
  });
});

describe('fulfillOrder against a lease taken over mid-flight', () => {
  const stolen: FakeSettlementOptions = { leaseStolenAfterClaim: true };

  it('writes nothing when the grant path loses the lease', async () => {
    const { settlement, deps } = harness(() => NOW, stolen);
    seedPayable(settlement);

    const result = await fulfillOrder(deps, ORDER);

    expect(result).toEqual({ outcome: 'lease_lost', reason: null });
    expect(settlement.grants).toHaveLength(0);
    expect(settlement.orders.get(ORDER)).toMatchObject({
      fulfillmentStatus: 'unfulfilled',
      fulfillmentLastError: null,
    });
  });

  it('writes nothing when a skipped order loses the lease before release', async () => {
    const { settlement, deps } = harness(() => NOW, stolen);
    settlement.seedOrder({
      orderRef: ORDER,
      collectionStatus: 'paid',
      receivedMinor: 100_000,
      settlementStatus: 'settled',
      fulfillmentStatus: 'fulfilled',
      fullyCollectedAtMs: NOW - 60_000,
      createdAtMs: NOW - 60_000,
      fulfillmentNextAttemptAtMs: NOW - 1_000,
    });

    const result = await fulfillOrder(deps, ORDER);

    expect(result).toEqual({ outcome: 'lease_lost', reason: null });
    // The queue field still belongs to the worker holding the lease now.
    expect(settlement.orders.get(ORDER)).toMatchObject({
      fulfillmentNextAttemptAtMs: NOW - 1_000,
    });
  });

  it('writes nothing when a deferred order loses the lease', async () => {
    const { settlement, deps } = harness(() => NOW, stolen);
    seedPayable(settlement);

    const result = await fulfillOrder({ ...deps, autoActivationEnabled: () => false }, ORDER);

    expect(result).toEqual({ outcome: 'lease_lost', reason: null });
    expect(settlement.orders.get(ORDER)).toMatchObject({
      fulfillmentStatus: 'unfulfilled',
      fulfillmentAttemptCount: 1,
    });
  });
});
