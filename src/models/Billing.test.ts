import { describe, expect, it } from 'vitest';
import { FirstPurchaseEligibility, Promotion, PromotionRedemption } from './Billing';

const basePromotion = {
  code: 'TEST10',
  normalizedCode: 'TEST10',
  minimumSubtotal: 0,
  eligibilityClass: 'public',
  perUserLimit: 1,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2027-01-01T00:00:00Z'),
};

describe('Promotion model validation', () => {
  it('accepts percentage without fixed amount or percentage cap', () => {
    const promotion = new Promotion({
      ...basePromotion,
      kind: 'percentage',
      percentageOff: 10,
    });
    expect(promotion.validateSync()).toBeUndefined();
  });

  it('accepts fixed amount without percentage fields', () => {
    const promotion = new Promotion({
      ...basePromotion,
      code: 'FIXED20',
      normalizedCode: 'FIXED20',
      kind: 'fixed',
      fixedAmount: 20_000,
    });
    expect(promotion.validateSync()).toBeUndefined();
  });

  it('requires the value matching the promotion kind', () => {
    const percentage = new Promotion({ ...basePromotion, kind: 'percentage' });
    const fixed = new Promotion({ ...basePromotion, kind: 'fixed' });
    expect(percentage.validateSync()?.errors['percentageOff']).toBeDefined();
    expect(fixed.validateSync()?.errors['fixedAmount']).toBeDefined();
  });
});

describe('promotion lifecycle models', () => {
  it('uses a singleton first-purchase eligibility record as the serialization point', () => {
    const user = '507f191e810c19729de860ea';
    const order = '507f191e810c19729de860eb';
    const eligibility = new FirstPurchaseEligibility({
      user,
      eligibilityClass: 'first_purchase',
      status: 'reserved',
      activeOrder: order,
      reservedAt: new Date('2026-07-26T00:00:00Z'),
    });

    expect(eligibility.validateSync()).toBeUndefined();
    expect(
      FirstPurchaseEligibility.schema
        .indexes()
        .some(
          ([key, options]) =>
            key['user'] === 1 && key['eligibilityClass'] === 1 && options.unique === true,
        ),
    ).toBe(true);
  });

  it('schedules a durable release check for reserved redemptions', () => {
    const redemption = new PromotionRedemption({
      promotion: '507f191e810c19729de860ea',
      order: '507f191e810c19729de860eb',
      user: '507f191e810c19729de860ec',
      status: 'reserved',
      discountAmount: 37_050,
      reservedAt: new Date('2026-07-26T00:00:00Z'),
      nextReleaseCheckAt: new Date('2026-07-26T00:15:00Z'),
    });

    expect(redemption.validateSync()).toBeUndefined();
    expect(redemption.get('releaseAttemptCount')).toBe(0);
  });
});
