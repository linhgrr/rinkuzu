import { describe, expect, it } from 'vitest';
import { UserPersistenceMapper } from '@/repositories/mappers/UserPersistenceMapper';
import type { UserPersistenceRecord } from '@/repositories/types/UserPersistence';

const record: UserPersistenceRecord = {
  _id: 'user-1',
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user',
  disable: 0,
  disabledAt: null,
  disabledBy: null,
  subscription: {
    planId: 'premium',
    planName: 'Premium',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-08-01T00:00:00.000Z'),
    isActive: true,
  },
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('UserPersistenceMapper', () => {
  it('normalizes persistence identity, disable state, and subscription data', () => {
    expect(UserPersistenceMapper.toEntity(record)).toEqual({
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
      disable: 0,
      disabledAt: null,
      disabledBy: null,
      subscription: {
        planId: 'premium',
        planName: 'Premium',
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-08-01T00:00:00.000Z'),
        isActive: true,
      },
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('maps disabled account metadata without inventing defaults', () => {
    expect(
      UserPersistenceMapper.toEntity({
        ...record,
        disable: 1,
        disabledAt: new Date('2026-07-10T00:00:00.000Z'),
        disabledBy: '507f191e810c19729de860ea',
      }),
    ).toMatchObject({
      disable: 1,
      disabledAt: new Date('2026-07-10T00:00:00.000Z'),
      disabledBy: '507f191e810c19729de860ea',
    });
  });

  it('fails closed when disable is missing or invalid (no nullish fallback)', () => {
    expect(() =>
      UserPersistenceMapper.toEntity({
        ...record,
        // @ts-expect-error intentional invalid
        disable: undefined,
      }),
    ).toThrow('user.disable must be exactly 0 or 1');

    expect(() =>
      UserPersistenceMapper.toEntity({
        ...record,
        // @ts-expect-error intentional invalid
        disable: 2,
      }),
    ).toThrow('user.disable must be exactly 0 or 1');
  });

  it('omits undefined subscription optionals when projecting the entitlement', () => {
    const entity = UserPersistenceMapper.toEntity({
      ...record,
      subscription: {
        planId: 'premium',
        planName: 'Premium',
        isActive: true,
        payosOrderId: 'order-1',
      },
    });

    expect(entity.subscription).toEqual({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
      payosOrderId: 'order-1',
    });
  });

  it('rejects a persistence record without identity', () => {
    expect(() => UserPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
      'user._id is required',
    );
  });
});
