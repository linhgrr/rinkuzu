import { describe, expect, it } from 'vitest';
import type { AdminSubscriptionRecord, AdminUserSubscriptionGrant } from '@/entities/AdminBilling';
import { AdminBillingDtoMapper } from '@/mappers/admin/AdminBillingDtoMapper';

const createdAt = new Date('2026-07-01T00:00:00.000Z');
const updatedAt = new Date('2026-07-01T01:00:00.000Z');

describe('AdminBillingDtoMapper', () => {
  it('omits absent optional payment and subscription dates', () => {
    const subscription: AdminSubscriptionRecord = {
      id: 'subscription-1',
      user: 'user-1',
      userEmail: 'learner@example.com',
      planId: 'premium',
      planName: 'Premium',
      amount: 100_000,
      currency: 'VND',
      status: 'pending',
      payosOrderId: 'order-1',
      isActive: false,
      createdAt,
      updatedAt,
    };

    const dto = AdminBillingDtoMapper.toSubscriptionDto(subscription);

    expect(dto).not.toHaveProperty('payosTransactionId');
    expect(dto).not.toHaveProperty('payosPaymentUrl');
    expect(dto).not.toHaveProperty('startDate');
    expect(dto).not.toHaveProperty('endDate');
  });

  it('omits an absent grant end date', () => {
    const grant: AdminUserSubscriptionGrant = {
      userId: 'user-1',
      userEmail: 'learner@example.com',
      planId: 'plan-1',
      planName: 'Premium',
      amount: 100_000,
      startDate: createdAt,
    };

    expect(AdminBillingDtoMapper.toGrantDto(grant)).toEqual({
      user: 'learner@example.com',
      plan: 'Premium',
      startDate: createdAt.toISOString(),
      isActive: true,
    });
  });
});
