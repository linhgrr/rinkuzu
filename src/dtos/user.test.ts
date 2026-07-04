import { describe, expect, it } from 'vitest';
import { publicProfileQuerySchema, userAttemptListQuerySchema } from '@/dtos/user';

describe('userAttemptListQuerySchema', () => {
  it('applies controller pagination defaults', () => {
    expect(userAttemptListQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('rejects invalid pagination values', () => {
    expect(userAttemptListQuerySchema.safeParse({ page: '0', limit: '10' }).success).toBe(false);
    expect(userAttemptListQuerySchema.safeParse({ page: '1', limit: '101' }).success).toBe(false);
  });
});

describe('publicProfileQuerySchema', () => {
  it('defaults to the first page and rejects invalid pages', () => {
    expect(publicProfileQuerySchema.parse({})).toEqual({ page: 1 });
    expect(publicProfileQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
