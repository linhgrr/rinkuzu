import { describe, expect, it } from 'vitest';
import {
  adminQuizIdParamsSchema,
  adminQuizListQuerySchema,
  adminQuizVisibilitySchema,
} from '@/dtos/admin-quiz';

const quizId = '507f191e810c19729de860ea';

describe('admin quiz controller schemas', () => {
  it('normalizes list query parameters', () => {
    expect(
      adminQuizListQuerySchema.parse({
        page: '2',
        limit: '24',
        search: '  algebra  ',
        visibility: 'private',
      }),
    ).toEqual({
      page: 2,
      limit: 24,
      search: 'algebra',
      visibility: 'private',
    });
  });

  it('defaults pagination and visibility', () => {
    expect(adminQuizListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 12,
      visibility: 'all',
    });
  });

  it('rejects invalid list and route inputs', () => {
    expect(adminQuizListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(adminQuizVisibilitySchema.safeParse('archived').success).toBe(false);
    expect(adminQuizIdParamsSchema.safeParse({ id: 'not-an-id' }).success).toBe(false);
  });

  it('accepts valid route params', () => {
    expect(adminQuizIdParamsSchema.parse({ id: quizId })).toEqual({ id: quizId });
  });
});
