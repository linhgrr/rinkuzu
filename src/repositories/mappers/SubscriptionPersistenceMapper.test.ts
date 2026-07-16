import { describe, expect, it } from 'vitest';
import { SubscriptionPersistenceMapper } from '@/repositories/mappers/SubscriptionPersistenceMapper';
import type { SubscriptionPersistenceRecord } from '@/repositories/types/SubscriptionPersistence';

const record: SubscriptionPersistenceRecord = {
  _id: 'subscription-1',
  user: 'user-1',
  userEmail: 'learner@example.com',
  type: 'premium',
  amount: 99000,
  currency: 'VND',
  status: 'completed',
  payosOrderId: 'order-1',
  startDate: new Date('2026-07-01T00:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

describe('SubscriptionPersistenceMapper', () => {
  it('normalizes subscription and user persistence identities', () => {
    expect(SubscriptionPersistenceMapper.toEntity(record)).toMatchObject({
      id: 'subscription-1',
      userId: 'user-1',
      status: 'completed',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T01:00:00.000Z'),
    });
  });

  it('rejects missing subscription or user identity', () => {
    expect(() => SubscriptionPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
      'subscription._id is required',
    );
    expect(() => SubscriptionPersistenceMapper.toEntity({ ...record, user: '' })).toThrow(
      'subscription.user is required',
    );
  });

  it('rejects completed subscriptions without their activation date', () => {
    const { startDate: _startDate, ...recordWithoutStartDate } = record;
    expect(() => SubscriptionPersistenceMapper.toEntity(recordWithoutStartDate)).toThrow(
      'subscription.startDate must be a valid date',
    );
  });
});
