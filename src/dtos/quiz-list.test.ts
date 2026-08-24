import { describe, expect, it } from 'vitest';
import { quizListQuerySchema } from '@/dtos/quiz';

describe('quizListQuerySchema', () => {
  it('parses strict list defaults at the controller boundary', () => {
    expect(quizListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 10,
      mine: false,
    });
  });

  it('accepts the canonical unfiled target and explicit booleans', () => {
    expect(
      quizListQuerySchema.parse({
        folder: 'unfiled',
        mine: 'true',
        visibility: 'personal',
      }),
    ).toEqual({
      folder: 'unfiled',
      page: 1,
      limit: 10,
      mine: true,
      visibility: 'personal',
    });
  });

  it('rejects former aliases and malformed pagination', () => {
    expect(quizListQuerySchema.safeParse({ folder: 'default' }).success).toBe(false);
    expect(quizListQuerySchema.safeParse({ folder: 'null' }).success).toBe(false);
    expect(quizListQuerySchema.safeParse({ page: 'NaN' }).success).toBe(false);
    expect(quizListQuerySchema.safeParse({ compact: 'true' }).success).toBe(false);
  });
});
