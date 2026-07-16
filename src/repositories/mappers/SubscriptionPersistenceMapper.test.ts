import { describe, expect, it } from 'vitest';
import {
  mapEmbeddedSubscription,
  SubscriptionPersistenceMapper,
} from '@/repositories/mappers/SubscriptionPersistenceMapper';
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

describe('mapEmbeddedSubscription', () => {
  it('maps required fields and omits undefined optionals', () => {
    expect(
      mapEmbeddedSubscription({
        type: 'premium',
        isActive: true,
      }),
    ).toEqual({
      type: 'premium',
      isActive: true,
    });
  });

  it('includes optional fields only when defined', () => {
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    expect(
      mapEmbeddedSubscription({
        type: 'premium',
        isActive: true,
        startDate,
        endDate,
        payosOrderId: 'order-1',
        payosTransactionId: 'txn-1',
      }),
    ).toEqual({
      type: 'premium',
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
      mapEmbeddedSubscription({
        type: 'free',
        isActive: false,
        payosOrderId: '',
      }),
    ).toEqual({
      type: 'free',
      isActive: false,
      payosOrderId: '',
    });
  });
});
