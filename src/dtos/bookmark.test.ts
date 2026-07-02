import { describe, expect, it } from 'vitest';
import { bookmarkListQuerySchema, createBookmarkRequestSchema } from '@/dtos/bookmark';

describe('bookmark DTO validation', () => {
  it('coerces and bounds list pagination', () => {
    expect(bookmarkListQuerySchema.parse({ page: '2', limit: '20' })).toEqual({
      page: 2,
      limit: 20,
    });
    expect(bookmarkListQuerySchema.safeParse({ page: 0, limit: 101 }).success).toBe(false);
  });

  it('rejects incomplete bookmark creation payloads', () => {
    expect(
      createBookmarkRequestSchema.safeParse({
        quiz: { slug: 'quiz', title: 'Quiz' },
        question: { text: '', options: ['only-one'], type: 'single' },
        questionIndex: -1,
      }).success,
    ).toBe(false);
  });

  it('accepts bookmark creation payloads without persistence quiz identifiers', () => {
    expect(
      createBookmarkRequestSchema.parse({
        quiz: { slug: 'quiz', title: 'Quiz', description: 'Description' },
        question: {
          text: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
        questionIndex: 0,
      }),
    ).toEqual({
      quiz: { slug: 'quiz', title: 'Quiz', description: 'Description' },
      question: {
        text: '2 + 2?',
        options: ['3', '4'],
        type: 'single',
        correctIndex: 1,
      },
      questionIndex: 0,
    });
  });
});
