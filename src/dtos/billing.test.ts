import { describe, expect, it } from 'vitest';
import { promotionCreateSchema } from './billing';

const basePromotion = {
  code: 'WELCOME',
  minimumSubtotal: 0,
  eligibilityClass: 'public' as const,
  perUserLimit: 1,
  startsAt: '2026-07-24T00:00:00.000Z',
  endsAt: '2026-08-24T00:00:00.000Z',
};

describe('billing DTOs', () => {
  it('accepts a fixed promotion without percentage fields', () => {
    expect(
      promotionCreateSchema.safeParse({
        ...basePromotion,
        kind: 'fixed',
        fixedAmount: 20_000,
      }).success,
    ).toBe(true);
  });

  it('accepts a percentage promotion without a fixed amount', () => {
    expect(
      promotionCreateSchema.safeParse({
        ...basePromotion,
        kind: 'percentage',
        percentageOff: 25,
        percentageCap: 50_000,
      }).success,
    ).toBe(true);
  });

  it('rejects values belonging to the other promotion kind', () => {
    expect(
      promotionCreateSchema.safeParse({
        ...basePromotion,
        kind: 'fixed',
        fixedAmount: 20_000,
        percentageOff: 25,
      }).success,
    ).toBe(false);
    expect(
      promotionCreateSchema.safeParse({
        ...basePromotion,
        kind: 'percentage',
        percentageOff: 25,
        fixedAmount: 20_000,
      }).success,
    ).toBe(false);
  });
});
