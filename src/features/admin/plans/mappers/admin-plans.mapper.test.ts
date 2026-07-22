import { describe, expect, it } from 'vitest';
import { toAdminBillingPlanViewModel } from '@/features/admin/plans/mappers/admin-plans.mapper';

describe('toAdminBillingPlanViewModel', () => {
  it('maps billing plan DTO to display-safe view model', () => {
    const result = toAdminBillingPlanViewModel({
      id: 'plan-1',
      name: 'Pro',
      price: 99000,
      duration: 'P1M',
      isActive: true,
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T01:00:00.000Z',
    });

    expect(result).toMatchObject({
      id: 'plan-1',
      priceLabel: '99.000 ₫',
      durationLabel: '1 Month',
      createdAtLabel: '07/02/2026',
      updatedAtLabel: '07/02/2026',
    });
  });

  it('rejects non-ISO legacy durations instead of compatibility fallback', () => {
    expect(() =>
      toAdminBillingPlanViewModel({
        id: 'plan-legacy',
        name: 'Legacy',
        price: 99000,
        duration: '12',
        isActive: true,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T01:00:00.000Z',
      }),
    ).toThrow('Unsupported subscription duration: 12');
  });
});
