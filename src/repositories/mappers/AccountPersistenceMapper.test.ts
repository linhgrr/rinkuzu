import { describe, expect, it } from 'vitest';
import { AccountPersistenceMapper } from '@/repositories/mappers/AccountPersistenceMapper';
import type { AccountProfilePersistenceRecord } from '@/repositories/types/AccountPersistence';

const profile: AccountProfilePersistenceRecord = {
  _id: 'account-1',
  email: 'learner@example.com',
  role: 'user',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('AccountPersistenceMapper', () => {
  it('omits absent optional profile and subscription fields', () => {
    expect(AccountPersistenceMapper.toProfile(profile)).toEqual({
      id: 'account-1',
      email: 'learner@example.com',
      role: 'user',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(
      AccountPersistenceMapper.toProfile({
        ...profile,
        displayName: 'Learner',
        subscription: { planId: 'premium', planName: 'Premium', isActive: true },
      }),
    ).toEqual({
      id: 'account-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      subscription: { planId: 'premium', planName: 'Premium', isActive: true },
    });
  });

  it('passes hasPassword through when the record carries it (RIN-1017)', () => {
    expect(AccountPersistenceMapper.toProfile({ ...profile, hasPassword: false })).toMatchObject({
      hasPassword: false,
    });
    expect(AccountPersistenceMapper.toProfile({ ...profile, hasPassword: true })).toMatchObject({
      hasPassword: true,
    });
  });

  it('maps subscription payos and date fields when present', () => {
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    expect(
      AccountPersistenceMapper.toProfile({
        ...profile,
        subscription: {
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          startDate,
          endDate,
          payosOrderId: 'order-1',
          payosTransactionId: 'txn-1',
        },
      }).subscription,
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

  it('omits an absent password hash without changing identity validation', () => {
    expect(AccountPersistenceMapper.toCredentials({ _id: 'account-1' })).toEqual({
      id: 'account-1',
    });
    expect(() => AccountPersistenceMapper.toCredentials({ _id: '' })).toThrow(
      'account._id is required',
    );
  });
});
