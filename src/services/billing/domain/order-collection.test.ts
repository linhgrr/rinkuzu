import { describe, expect, it } from 'vitest';
import { deriveOrderCollection } from './order-collection';

describe('deriveOrderCollection', () => {
  it('derives the status from the ledger total against what is owed', () => {
    expect(deriveOrderCollection({ receivedMinor: 0, finalMinor: 100_000 })).toEqual({
      status: 'unpaid',
      excessMinor: 0,
      fullyCollected: false,
    });
    expect(deriveOrderCollection({ receivedMinor: 40_000, finalMinor: 100_000 })).toMatchObject({
      status: 'partial',
      fullyCollected: false,
    });
    expect(deriveOrderCollection({ receivedMinor: 100_000, finalMinor: 100_000 })).toMatchObject({
      status: 'paid',
      excessMinor: 0,
      fullyCollected: true,
    });
  });

  it('records an overpayment as excess instead of losing it', () => {
    expect(deriveOrderCollection({ receivedMinor: 120_000, finalMinor: 100_000 })).toEqual({
      status: 'overpaid',
      excessMinor: 20_000,
      fullyCollected: true,
    });
  });

  it('never derives review, so automation cannot wash an order out of it', () => {
    for (const receivedMinor of [0, 1, 99_999, 100_000, 100_001, 10_000_000]) {
      const derived = deriveOrderCollection({ receivedMinor, finalMinor: 100_000 });
      expect(derived.status as string).not.toBe('review');
      // Excess is never negative and always agrees with the status.
      expect(derived.excessMinor).toBeGreaterThanOrEqual(0);
      expect(derived.excessMinor > 0).toBe(derived.status === 'overpaid');
      expect(derived.fullyCollected).toBe(receivedMinor >= 100_000);
    }
  });

  it('says nothing about entitlement', () => {
    // Collection is what the provider took and nothing else. An order whose
    // payment was refunded is still `paid` here; whether the customer keeps
    // Premium is the settlement ledger's answer, and keying fulfillment off
    // this status is exactly the bug that granted Premium after a refund.
    const collected = deriveOrderCollection({ receivedMinor: 100_000, finalMinor: 100_000 });
    expect(Object.keys(collected).sort()).toEqual(['excessMinor', 'fullyCollected', 'status']);
  });
});
