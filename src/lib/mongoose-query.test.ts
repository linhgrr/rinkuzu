import { describe, expect, it } from 'vitest';
import { buildMongoOrFilter } from '@/lib/mongoose-query';

describe('buildMongoOrFilter', () => {
  it('returns the only active filter without wrapping it in $or', () => {
    expect(buildMongoOrFilter([{ userId: 'user-1' }, null])).toEqual({ userId: 'user-1' });
  });

  it('combines multiple active filters with $or', () => {
    expect(buildMongoOrFilter([{ userId: 'user-1' }, { userEmail: 'a@example.com' }])).toEqual({
      $or: [{ userId: 'user-1' }, { userEmail: 'a@example.com' }],
    });
  });

  it('rejects empty filters', () => {
    expect(() => buildMongoOrFilter([null])).toThrow(
      'buildMongoOrFilter requires at least one filter',
    );
  });
});
