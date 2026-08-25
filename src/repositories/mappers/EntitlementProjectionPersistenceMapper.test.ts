import { describe, expect, it } from 'vitest';
import { mapEntitlementProjection } from '@/repositories/mappers/EntitlementProjectionPersistenceMapper';

describe('mapEntitlementProjection', () => {
  it('maps required fields and omits undefined optionals', () => {
    expect(
      mapEntitlementProjection({
        planId: 'premium',
        planName: 'Premium',
        isActive: true,
      }),
    ).toEqual({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
    });
  });

  it('includes optional fields only when defined', () => {
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    expect(
      mapEntitlementProjection({
        planId: 'premium',
        planName: 'Premium',
        isActive: true,
        startDate,
        endDate,
        payosOrderId: 'order-1',
        payosTransactionId: 'txn-1',
      }),
    ).toEqual({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
      startDate,
      endDate,
      payosOrderId: 'order-1',
      payosTransactionId: 'txn-1',
    });
  });

  it('does not treat empty string as absent for payosOrderId', () => {
    // undefined is the sole omit signal; empty string is still included
    expect(
      mapEntitlementProjection({
        planId: 'free',
        planName: 'Free',
        isActive: false,
        payosOrderId: '',
      }),
    ).toEqual({
      planId: 'free',
      planName: 'Free',
      isActive: false,
      payosOrderId: '',
    });
  });
});
