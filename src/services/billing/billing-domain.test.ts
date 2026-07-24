import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  calculateDiscount,
  canApplyCollectionTransition,
  hashIdempotencyRequest,
  normalizePromoCode,
  replayEntitlement,
} from './billing-domain';

describe('billing domain', () => {
  it('normalizes safe ASCII promo codes and rejects Unicode homoglyphs', () => {
    expect(normalizePromoCode('  first-50 ')).toBe('FIRST-50');
    expect(() => normalizePromoCode('FΙRST50')).toThrow('Promo code is not applicable');
  });

  it('floors percentage discounts and rejects a final amount below the VND floor', () => {
    expect(
      calculateDiscount(99_001, {
        kind: 'percentage',
        percentageOff: 15,
        percentageCap: 20_000,
        minimumSubtotal: 10_000,
      }),
    ).toEqual({ discountAmount: 14_850, finalAmount: 84_151 });

    expect(() =>
      calculateDiscount(10_000, {
        kind: 'fixed',
        fixedAmount: 9_000,
        minimumSubtotal: 0,
      }),
    ).toThrow('Promo code is not applicable');
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
    expect(canApplyCollectionTransition('paid', 'cancelled')).toBe(false);
    expect(canApplyCollectionTransition('expired', 'paid')).toBe(true);
  });
});
