import { describe, expect, it } from 'vitest';
import { UserPersistenceMapper } from '@/repositories/mappers/UserPersistenceMapper';
import type { UserPersistenceRecord } from '@/repositories/types/UserPersistence';

const record: UserPersistenceRecord = {
  _id: 'user-1',
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user',
  subscription: {
    type: 'premium',
    startDate: new Date('2026-07-01T00:00:00.000Z'),
    endDate: new Date('2026-08-01T00:00:00.000Z'),
    isActive: true,
  },
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('UserPersistenceMapper', () => {
  it('normalizes persistence identity and subscription data', () => {
    expect(UserPersistenceMapper.toEntity(record)).toEqual({
      id: 'user-1',
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
      subscription: {
        type: 'premium',
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-08-01T00:00:00.000Z'),
        isActive: true,
      },
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('rejects a persistence record without identity', () => {
    expect(() => UserPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
      'user._id is required',
    );
  });
});
