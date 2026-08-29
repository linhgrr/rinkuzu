import { describe, expect, it } from 'vitest';
import {
  recordExternalMoneyAdjustment,
  resolveOrderExcess,
  type AdjustmentDeps,
} from '@/services/billing/adjustments/record-adjustment';
import {
  FakeAdjustmentRepository,
  FakeDuplicateKeyError,
  type FakeAdjustmentOptions,
  type FakeAdjustmentOrder,
} from '../../helpers/billing-adjustment-double';

const ORDER = 'order-1';
const PUBLIC_ID = 'a3b0c442-98fc-1c14-9afb-4c4d0f3ab000';
const OCCURRED_AT = '2026-08-28T09:00:00.000Z';
const NOW = Date.UTC(2026, 7, 28, 10, 0, 0);

interface Harness {
  repository: FakeAdjustmentRepository;
  deps: AdjustmentDeps;
  order: FakeAdjustmentOrder;
}

function harness(
  order: Partial<FakeAdjustmentOrder> = {},
  options: FakeAdjustmentOptions = {},
  autoRevocationEnabled = true,
): Harness {
  const repository = new FakeAdjustmentRepository(options);
  const seeded = repository.seedOrder({ orderRef: ORDER, publicId: PUBLIC_ID, ...order });
  return {
    repository,
    order: seeded,
    deps: {
      adjustments: repository,
      clock: () => NOW,
      autoRevocationEnabled: () => autoRevocationEnabled,
    },
  };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    recordedBy: 'admin-1',
    orderId: PUBLIC_ID,
    type: 'refund' as const,
    externalReference: 'ref-1',
    amount: 100_000,
    currency: 'VND',
    allocation: 'principal' as const,
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

/**
 * The handler owns every decision an adjustment implies: whether the ledger
 * admits it, what it means for the entitlement, what a reused reference means,
 * and what happens to the queued fulfillment work. Persistence owns none of
 * them, which is what makes all of it testable without a database.
 */
describe('a reused external reference', () => {
  it('reports the order it already adjusted when the money is identical', async () => {
    const { repository, deps } = harness();

    await recordExternalMoneyAdjustment(deps, refund());
    const replay = await recordExternalMoneyAdjustment(deps, refund());

    expect(replay.id).toBe(PUBLIC_ID);
    expect(repository.adjustments).toHaveLength(1);
    // One revocation, not two: a replay must not claw the entitlement twice.
    expect(repository.entitlementEvents).toHaveLength(0);
  });

  it('refuses the same reference carrying a different amount', async () => {
    const { repository, deps } = harness();
    await recordExternalMoneyAdjustment(deps, refund());

    await expect(
      recordExternalMoneyAdjustment(deps, refund({ amount: 40_000 })),
    ).rejects.toMatchObject({ code: 'adjustment_reference_conflict', status: 409 });
    expect(repository.adjustments).toHaveLength(1);
  });

  it('refuses the same reference at a different instant', async () => {
    // Two genuinely different events on one bank statement line. Treating the
    // second as a replay would silently drop money.
    const { deps } = harness();
    await recordExternalMoneyAdjustment(deps, refund());

    await expect(
      recordExternalMoneyAdjustment(deps, refund({ occurredAt: '2026-08-29T09:00:00.000Z' })),
    ).rejects.toMatchObject({ code: 'adjustment_reference_conflict' });
  });

  it('refuses the same reference against another order', async () => {
    const { repository, deps } = harness();
    repository.seedOrder({ orderRef: 'order-2', publicId: 'other-public-id' });
    await recordExternalMoneyAdjustment(deps, refund());

    await expect(
      recordExternalMoneyAdjustment(deps, refund({ orderId: 'other-public-id' })),
    ).rejects.toMatchObject({ code: 'adjustment_reference_conflict', status: 409 });
    // The untouched order must not be reported back as though it had been
    // adjusted; that is how a mis-keyed entry lands nowhere and looks fine.
    expect(repository.adjustments.every((entry) => entry.orderRef === ORDER)).toBe(true);
  });
});

describe('two operators reaching the insert at once', () => {
  it('treats the loser of an identical race as the replay it is', async () => {
    // The winner's row is already there by the time this one inserts, so the
    // insert raises a duplicate key. Discriminating it, rather than assuming a
    // replay, is what separates this case from the two below.
    const { repository, deps } = harness();
    const first = await recordExternalMoneyAdjustment(deps, refund());
    const second = await recordExternalMoneyAdjustment(deps, refund());

    expect(second).toEqual(first);
    expect(repository.adjustments).toHaveLength(1);
  });

  it('does not swallow a collision on an unrelated unique index', async () => {
    // A duplicate key that is not this reference's says nothing about a replay.
    // Reporting it as success would tell an operator the money was recorded
    // when nothing was written at all.
    const { repository, deps } = harness(
      {},
      { insertError: new FakeDuplicateKeyError('order_1_type_1') },
    );

    await expect(recordExternalMoneyAdjustment(deps, refund())).rejects.toBeInstanceOf(
      FakeDuplicateKeyError,
    );
    expect(repository.adjustments).toHaveLength(0);
  });
});

describe('what an adjustment does to the fulfillment queue', () => {
  it('cancels queued work the moment the money stops covering the order', async () => {
    const { repository, deps } = harness({
      fulfillmentDueAtMs: NOW - 1_000,
      fulfillmentLeaseToken: 'worker-a',
    });

    await recordExternalMoneyAdjustment(deps, refund());

    const order = repository.orders.get(ORDER);
    expect(order?.fulfillmentDueAtMs).toBeNull();
    // Dropping the lease is what dispossesses a worker that is granting right
    // now, so its own commit rolls back instead of completing.
    expect(order?.fulfillmentLeaseToken).toBeNull();
  });

  it('revokes a grant the order actually produced', async () => {
    const { repository, deps } = harness({ fulfillmentStatus: 'fulfilled', granted: true });

    const view = await recordExternalMoneyAdjustment(deps, refund());

    expect(view.fulfillmentStatus).toBe('revoked');
    expect(repository.entitlementEvents).toEqual([{ kind: 'revoke', orderRef: ORDER }]);
  });

  it('parks a fulfilled order for a person when automation may not revoke', async () => {
    const { repository, deps } = harness(
      { fulfillmentStatus: 'fulfilled', granted: true },
      {},
      false,
    );

    const view = await recordExternalMoneyAdjustment(deps, refund());

    expect(view.fulfillmentStatus).toBe('review');
    expect(repository.entitlementEvents).toHaveLength(0);
  });

  it('arms fulfillment when a credit makes an underpaid order whole', async () => {
    const { repository, deps } = harness({ receivedMinor: 60_000 });

    const view = await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      type: 'credit',
      amount: 40_000,
      externalReference: 'credit-1',
    });

    expect(view.settlementStatus).toBe('settled');
    expect(repository.orders.get(ORDER)?.fulfillmentDueAtMs).toBe(NOW);
    // Nothing to restore: this order never produced a grant, and the old code
    // tried to restore one and left the customer with nothing.
    expect(repository.entitlementEvents).toHaveLength(0);
  });

  it('queues a revoked order that never had a grant instead of restoring nothing', async () => {
    const { repository, deps } = harness({
      receivedMinor: 60_000,
      fulfillmentStatus: 'revoked',
      granted: false,
    });

    await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      type: 'credit',
      amount: 40_000,
      externalReference: 'credit-2',
    });

    const order = repository.orders.get(ORDER);
    expect(order?.fulfillmentStatus).toBe('unfulfilled');
    expect(order?.fulfillmentDueAtMs).toBe(NOW);
  });

  it('restores the grant a reversed chargeback took away', async () => {
    const { repository, deps } = harness({
      fulfillmentStatus: 'fulfilled',
      granted: true,
    });
    await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      type: 'chargeback',
      externalReference: 'cb-1',
    });
    expect(repository.orders.get(ORDER)?.fulfillmentStatus).toBe('revoked');

    const view = await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      type: 'chargeback_reversal',
      externalReference: 'cb-reversal-1',
    });

    expect(view.settlementStatus).toBe('settled');
    expect(view.fulfillmentStatus).toBe('fulfilled');
    expect(repository.entitlementEvents.map((event) => event.kind)).toEqual(['revoke', 'restore']);
  });

  it('leaves an order an operator has taken over out of the queue', async () => {
    const { repository, deps } = harness({ receivedMinor: 60_000, fulfillmentStatus: 'review' });

    await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      type: 'credit',
      amount: 40_000,
      externalReference: 'credit-3',
    });

    const order = repository.orders.get(ORDER);
    expect(order?.fulfillmentStatus).toBe('review');
    expect(order?.fulfillmentDueAtMs).toBeNull();
  });
});

describe('what the ledger refuses', () => {
  it('refuses a reversal with no chargeback behind it', async () => {
    const { repository, deps } = harness();
    await recordExternalMoneyAdjustment(deps, refund());

    await expect(
      recordExternalMoneyAdjustment(deps, {
        ...refund(),
        type: 'chargeback_reversal',
        externalReference: 'reversal-of-nothing',
      }),
    ).rejects.toMatchObject({ code: 'reversal_without_chargeback', status: 409 });
    // The refusal is a rollback, not a partial write.
    expect(repository.adjustments).toHaveLength(1);
    expect(repository.orders.get(ORDER)?.settlementStatus).toBe('refunded');
  });

  it('refuses a second refund that would return more than ever arrived', async () => {
    const { deps } = harness();
    await recordExternalMoneyAdjustment(deps, refund({ amount: 60_000 }));

    await expect(
      recordExternalMoneyAdjustment(deps, refund({ amount: 60_000, externalReference: 'ref-2' })),
    ).rejects.toMatchObject({ code: 'adjustment_exceeds_payment' });
  });

  it('refuses an adjustment against an order that never received money', async () => {
    const { deps } = harness({ paymentTransactionRef: null, receivedMinor: 0 });

    await expect(recordExternalMoneyAdjustment(deps, refund())).rejects.toMatchObject({
      code: 'payment_not_found',
    });
  });

  it('refuses an adjustment in the wrong currency', async () => {
    const { deps } = harness();

    await expect(
      recordExternalMoneyAdjustment(deps, refund({ currency: 'USD' })),
    ).rejects.toMatchObject({ code: 'currency_mismatch' });
  });
});

describe('an operator verdict on an overpayment', () => {
  function overpaid(): Harness {
    return harness({ receivedMinor: 130_000, excessResolution: 'unallocated' });
  }

  it('records the disposal as money, not as a flag', async () => {
    const { repository, deps } = overpaid();

    const view = await resolveOrderExcess(deps, {
      recordedBy: 'admin-1',
      orderId: PUBLIC_ID,
      command: 'refund',
      reason: 'Returned to the payer bank account',
    });

    expect(view.excessResolution).toBe('refunded');
    // The whole point: there is an adjustment behind the label, allocated to
    // the excess and sized to what was actually outstanding.
    expect(repository.adjustments).toHaveLength(1);
    expect(repository.adjustments[0]?.ledger).toEqual({
      type: 'refund',
      allocation: 'excess',
      amountMinor: 30_000,
    });
    expect(repository.orders.get(ORDER)?.excessReason).toBe('Returned to the payer bank account');
  });

  it('leaves the entitlement alone: the surplus was never what paid for it', async () => {
    const { repository, deps } = harness({
      receivedMinor: 130_000,
      excessResolution: 'unallocated',
      fulfillmentStatus: 'fulfilled',
      granted: true,
    });

    const view = await resolveOrderExcess(deps, {
      recordedBy: 'admin-1',
      orderId: PUBLIC_ID,
      command: 'refund',
      reason: 'Returned to the payer bank account',
    });

    expect(view.fulfillmentStatus).toBe('fulfilled');
    expect(repository.entitlementEvents).toHaveLength(0);
  });

  it('refuses a second verdict on an overpayment the ledger already closed', async () => {
    const { deps } = overpaid();
    const command = {
      recordedBy: 'admin-1',
      orderId: PUBLIC_ID,
      command: 'write_off' as const,
      reason: 'Below the cost of returning it',
    };
    await resolveOrderExcess(deps, command);

    await expect(resolveOrderExcess(deps, command)).rejects.toMatchObject({
      code: 'excess_not_resolvable',
      status: 409,
    });
  });

  it('refuses a verdict on an order that never overpaid', async () => {
    const { deps } = harness();

    await expect(
      resolveOrderExcess(deps, {
        recordedBy: 'admin-1',
        orderId: PUBLIC_ID,
        command: 'refund',
        reason: 'There is nothing here to refund',
      }),
    ).rejects.toMatchObject({ code: 'excess_not_resolvable' });
  });

  it('requires a stated reason', async () => {
    const { repository, deps } = overpaid();

    await expect(
      resolveOrderExcess(deps, {
        recordedBy: 'admin-1',
        orderId: PUBLIC_ID,
        command: 'refund',
        reason: '   ',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(repository.adjustments).toHaveLength(0);
  });

  it('disposes of what is left, not of what the page showed', async () => {
    // Someone refunded part of the surplus through the adjustment surface a
    // moment ago. The verdict takes the remainder, read inside the commit.
    const { repository, deps } = overpaid();
    await recordExternalMoneyAdjustment(deps, {
      ...refund(),
      allocation: 'excess',
      amount: 10_000,
      externalReference: 'partial-excess-refund',
    });

    await resolveOrderExcess(deps, {
      recordedBy: 'admin-1',
      orderId: PUBLIC_ID,
      command: 'write_off',
      reason: 'The rest is below the cost of returning it',
    });

    const verdict = repository.adjustments.at(-1);
    expect(verdict?.ledger).toEqual({
      type: 'write_off',
      allocation: 'excess',
      amountMinor: 20_000,
    });
    expect(repository.orders.get(ORDER)?.excessResolution).toBe('refunded');
  });
});
