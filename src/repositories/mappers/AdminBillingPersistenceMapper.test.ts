import { describe, expect, it } from 'vitest';
import { AdminBillingPersistenceMapper } from '@/repositories/mappers/AdminBillingPersistenceMapper';

describe('AdminBillingPersistenceMapper', () => {
  it('omits absent optional payment and activation fields', () => {
    const now = new Date('2026-07-01T00:00:00.000Z');
    const entity = AdminBillingPersistenceMapper.toSubscription({
      _id: 'subscription-1',
      user: 'user-1',
      userEmail: 'learner@example.com',
      planId: 'premium',
      planName: 'Premium',
      amount: 99_000,
      currency: 'VND',
      status: 'pending',
      payosOrderId: 'order-1',
      isActive: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(entity).not.toHaveProperty('payosTransactionId');
    expect(entity).not.toHaveProperty('payosPaymentUrl');
    expect(entity).not.toHaveProperty('startDate');
    expect(entity).not.toHaveProperty('endDate');
  });
});
