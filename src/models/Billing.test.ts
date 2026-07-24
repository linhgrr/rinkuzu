import { describe, expect, it } from 'vitest';
import { Promotion } from './Billing';

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
