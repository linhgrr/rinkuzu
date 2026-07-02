import { describe, expect, it } from 'vitest';
import { toProfileHistoryViewModel } from '@/features/profile/mappers/profile-history.mapper';

describe('toProfileHistoryViewModel', () => {
  it('maps user attempt history without deleted-quiz compatibility state', () => {
    expect(
      toProfileHistoryViewModel({
        attempts: [
          {
            id: 'attempt-1',
            score: 88,
            takenAt: '2026-07-02T00:00:00.000Z',
            totalQuestions: 10,
            quiz: {
              title: 'Algebra',
              slug: 'algebra',
              description: 'Linear equations',
            },
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    ).toEqual({
      attempts: [
        {
          id: 'attempt-1',
          score: 88,
          takenAt: '2026-07-02T00:00:00.000Z',
          takenAtLabel: '07/02/2026',
          totalQuestions: 10,
          quiz: {
            title: 'Algebra',
            slug: 'algebra',
            description: 'Linear equations',
          },
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });
});
