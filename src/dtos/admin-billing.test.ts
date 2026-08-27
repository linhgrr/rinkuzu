import { describe, expect, it } from 'vitest';
import {
  adminSubscriptionListQuerySchema,
  createPlanRequestSchema,
  revokeSubscriptionRequestSchema,
  updatePlanRequestSchema,
} from '@/dtos/admin-billing';

describe('admin subscription controller schemas', () => {
  it('accepts the supported monthly and six-month plan durations', () => {
    const basePlan = {
      name: 'Premium',
      price: 199_000,
      isActive: true,
    };

    expect(createPlanRequestSchema.safeParse({ ...basePlan, duration: 'P1M' }).success).toBe(true);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, duration: 'P6M' }).success).toBe(true);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, duration: 'P3M' }).success).toBe(false);
  });

  it('rejects a plan price that could never be charged', () => {
    const basePlan = { name: 'Premium', duration: 'P1M', isActive: true };

    // PayOS refuses anything under 2,000 VND, and the order schema stores money
    // as whole minor units. Both used to pass here and blow up mid-transaction.
    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: 1_999 }).success).toBe(false);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: 99.99 }).success).toBe(false);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: 0 }).success).toBe(false);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: -5_000 }).success).toBe(false);

    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: 2_000 }).success).toBe(true);
    expect(createPlanRequestSchema.safeParse({ ...basePlan, price: 199_000 }).success).toBe(true);
  });

  it('applies the same price floor to a plan update', () => {
    const base = { id: 'plan_x' };
    expect(updatePlanRequestSchema.safeParse({ ...base, price: 1_500 }).success).toBe(false);
    expect(updatePlanRequestSchema.safeParse({ ...base, price: 149_000 }).success).toBe(true);
    // A rename must not be blocked by a price it does not touch.
    expect(updatePlanRequestSchema.safeParse({ ...base, name: 'Renamed' }).success).toBe(true);
  });

  it('parses and bounds list query parameters', () => {
    expect(
      adminSubscriptionListQuerySchema.parse({
        page: '2',
        limit: '50',
        status: 'expired',
        search: '  user@example.com  ',
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      status: 'expired',
      search: 'user@example.com',
    });

    expect(adminSubscriptionListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(adminSubscriptionListQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
    // Statuses the projection can never derive are rejected instead of
    // silently returning an empty page.
    for (const status of ['pending', 'failed', 'cancelled']) {
      expect(adminSubscriptionListQuerySchema.safeParse({ status }).success).toBe(false);
    }
  });

  it('allows only explicit subscription update fields', () => {
    expect(
      revokeSubscriptionRequestSchema.parse({ action: 'revoke', reason: 'confirmed fraud' }),
    ).toEqual({ action: 'revoke', reason: 'confirmed fraud' });
    // A reason is mandatory: the ledger records it as the revocation's audit trail.
    expect(revokeSubscriptionRequestSchema.safeParse({ action: 'revoke' }).success).toBe(false);
    expect(
      revokeSubscriptionRequestSchema.safeParse({ action: 'revoke', reason: 'no' }).success,
    ).toBe(false);
    // The endpoint no longer pretends to set an arbitrary status.
    expect(revokeSubscriptionRequestSchema.safeParse({ status: 'cancelled' }).success).toBe(false);
    expect(
      revokeSubscriptionRequestSchema.safeParse({ action: 'expire', reason: 'because' }).success,
    ).toBe(false);
    expect(revokeSubscriptionRequestSchema.safeParse({}).success).toBe(false);
  });
});
