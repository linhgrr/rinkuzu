import { describe, expect, it } from 'vitest';
import { userAttemptListQuerySchema } from '@/dtos/user';

describe('userAttemptListQuerySchema', () => {
  it('applies controller pagination defaults', () => {
    expect(userAttemptListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('rejects invalid pagination values', () => {
    expect(userAttemptListQuerySchema.safeParse({ page: '0', limit: '10' }).success).toBe(false);
    expect(userAttemptListQuerySchema.safeParse({ page: '1', limit: '101' }).success).toBe(false);
  });
});
