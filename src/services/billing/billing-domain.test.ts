import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  BillingDomainError,
  calculateDiscount,
  isLocallyExpiredAttempt,
  resolveCollectionTransition,
  hashIdempotencyRequest,
  normalizePromoCode,
  replayEntitlement,
} from './billing-domain';

function captureBillingError(action: () => unknown): BillingDomainError {
  try {
    action();
  } catch (error) {
    if (error instanceof BillingDomainError) return error;
    throw error;
  }
  throw new Error('Expected a BillingDomainError');
}

describe('billing domain', () => {
  it('normalizes safe ASCII promo codes and rejects Unicode homoglyphs', () => {
    expect(normalizePromoCode('  first-50 ')).toBe('FIRST-50');
    expect(() => normalizePromoCode('FΙRST50')).toThrow('Promo code is not applicable');
  });

  it('floors percentage discounts and identifies a final amount below the VND floor as plan-ineligible', () => {
    expect(
      calculateDiscount(99_001, {
        kind: 'percentage',
        percentageOff: 15,
        percentageCap: 20_000,
        minimumSubtotal: 10_000,
      }),
    ).toEqual({ discountAmount: 14_850, finalAmount: 84_151 });

    const error = captureBillingError(() =>
      calculateDiscount(10_000, {
        kind: 'fixed',
        fixedAmount: 9_000,
        minimumSubtotal: 0,
      }),
    );
    expect(error).toMatchObject({
      code: 'promo_not_eligible_for_plan',
      status: 409,
    });
  });

  it('identifies a subtotal below the promo minimum as plan-ineligible', () => {
    const error = captureBillingError(() =>
      calculateDiscount(19_000, {
        kind: 'percentage',
        percentageOff: 10,
        minimumSubtotal: 20_000,
      }),
    );
    expect(error).toMatchObject({
      code: 'promo_not_eligible_for_plan',
      status: 409,
    });
  });

  it('rejects a 95% discount on 39,000 VND because the payable amount would be 1,950 VND', () => {
    const error = captureBillingError(() =>
      calculateDiscount(39_000, {
        kind: 'percentage',
        percentageOff: 95,
        minimumSubtotal: 0,
      }),
    );
    expect(error).toMatchObject({
      code: 'promo_not_eligible_for_plan',
      status: 409,
    });
  });

  it('keeps malformed promo codes on the generic non-applicable error', () => {
    const error = captureBillingError(() => normalizePromoCode('not valid!'));
    expect(error).toMatchObject({
      code: 'promo_not_applicable',
      status: 400,
    });
  });

  it('hashes semantically identical object key order consistently', () => {
    const left = hashIdempotencyRequest({
      endpoint: '/orders',
      apiVersion: 'v1',
      payload: { planId: 'premium', promoCode: null },
    });
    const right = hashIdempotencyRequest({
      endpoint: '/orders',
      apiVersion: 'v1',
      payload: { promoCode: null, planId: 'premium' },
    });
    expect(left).toBe(right);
  });

  it('keeps the original month anchor across short months', () => {
    const february = addCalendarMonths(new Date('2024-01-31T10:00:00.000Z'), 1, 31);
    expect(february.toISOString()).toBe('2024-02-29T10:00:00.000Z');
    expect(addCalendarMonths(february, 1, 31).toISOString()).toBe('2024-03-31T10:00:00.000Z');
  });

  it('replays grants from the immutable segment baseline after a refund', () => {
    const grants = [
      {
        id: 'a',
        sequence: 1,
        segmentId: 'segment',
        segmentBaselineStartAt: new Date('2024-01-01T00:00:00.000Z'),
        segmentAnchorDay: 1,
        durationUnit: 'month' as const,
        durationValue: 1,
      },
      {
        id: 'b',
        sequence: 2,
        segmentId: 'segment',
        segmentBaselineStartAt: new Date('2024-01-01T00:00:00.000Z'),
        segmentAnchorDay: 1,
        durationUnit: 'month' as const,
        durationValue: 1,
      },
    ];
    expect(replayEntitlement(grants, []).endAt?.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(
      replayEntitlement(grants, [
        { sequence: 3, grantId: 'a', type: 'revoke' },
      ]).endAt?.toISOString(),
    ).toBe('2024-02-01T00:00:00.000Z');
  });

  it('never lets an out-of-order terminal event downgrade paid', () => {
    expect(resolveCollectionTransition('paid', 'cancelled', 0)).toBeNull();
    expect(resolveCollectionTransition('expired', 'paid', 0)).toBe('paid');
  });

  describe('resolveCollectionTransition', () => {
    it('escalates a part payment landing on a closed attempt to review', () => {
      // The rank ladder refuses partial(2) < cancelled(3); dropping it would
      // leave real money invisible on the order.
      expect(resolveCollectionTransition('cancelled', 'partial', 0)).toBeNull();
      for (const closed of ['cancelled', 'expired', 'failed']) {
        expect(resolveCollectionTransition(closed, 'partial', 40_000)).toBe('review');
      }
    });

    it('still lets a full payment settle a closed attempt directly', () => {
      expect(resolveCollectionTransition('cancelled', 'paid', 100_000)).toBe('paid');
      expect(resolveCollectionTransition('expired', 'paid', 100_000)).toBe('paid');
    });

    it('applies an ordinary forward transition unchanged', () => {
      expect(resolveCollectionTransition('pending', 'partial', 40_000)).toBe('partial');
      expect(resolveCollectionTransition('creating', 'pending', 0)).toBe('pending');
    });

    it('is a no-op for a blocked transition with no money behind it', () => {
      expect(resolveCollectionTransition('cancelled', 'pending', 0)).toBeNull();
      expect(resolveCollectionTransition('paid', 'cancelled', 0)).toBeNull();
    });

    it('does not re-escalate an attempt already in review', () => {
      expect(resolveCollectionTransition('review', 'partial', 40_000)).toBeNull();
    });
  });

  describe('isLocallyExpiredAttempt', () => {
    const past = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-01T00:20:00.000Z').getTime();

    it('closes a lapsed unpaid link the provider still calls pending', () => {
      expect(
        isLocallyExpiredAttempt({ observed: 'pending', amountPaid: 0, expiresAt: past, now }),
      ).toBe(true);
      expect(
        isLocallyExpiredAttempt({ observed: 'creating', amountPaid: 0, expiresAt: past, now }),
      ).toBe(true);
    });

    it('never expires an attempt that has money against it', () => {
      expect(
        isLocallyExpiredAttempt({ observed: 'pending', amountPaid: 1, expiresAt: past, now }),
      ).toBe(false);
    });

    it('leaves a link that has not lapsed yet alone', () => {
      const future = new Date('2026-01-01T00:30:00.000Z');
      expect(
        isLocallyExpiredAttempt({ observed: 'pending', amountPaid: 0, expiresAt: future, now }),
      ).toBe(false);
    });

    it('does not override a status the provider already settled', () => {
      for (const observed of ['paid', 'cancelled', 'expired', 'failed', 'review']) {
        expect(isLocallyExpiredAttempt({ observed, amountPaid: 0, expiresAt: past, now })).toBe(
          false,
        );
      }
    });
  });
});
