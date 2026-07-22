import { describe, expect, it } from 'vitest';
import {
  adminSubscriptionListQuerySchema,
  createPlanRequestSchema,
  updateSubscriptionRequestSchema,
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

  it('parses and bounds list query parameters', () => {
    expect(
      adminSubscriptionListQuerySchema.parse({
        page: '2',
        limit: '50',
        status: 'failed',
        search: '  user@example.com  ',
      }),
    ).toEqual({
      page: 2,
      limit: 50,
      status: 'failed',
      search: 'user@example.com',
    });

    expect(adminSubscriptionListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(adminSubscriptionListQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });

  it('allows only explicit subscription update fields', () => {
    expect(updateSubscriptionRequestSchema.parse({ status: 'cancelled' })).toEqual({
      status: 'cancelled',
    });
    expect(updateSubscriptionRequestSchema.safeParse({}).success).toBe(false);
    expect(updateSubscriptionRequestSchema.safeParse({ status: 'completed' }).success).toBe(false);
    expect(updateSubscriptionRequestSchema.safeParse({ isActive: true }).success).toBe(false);
    expect(updateSubscriptionRequestSchema.safeParse({ status: 'unknown' }).success).toBe(false);
    expect(updateSubscriptionRequestSchema.safeParse({ foo: 'bar' }).success).toBe(false);
  });
});
