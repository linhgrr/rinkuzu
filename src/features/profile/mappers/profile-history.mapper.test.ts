import { describe, expect, it } from 'vitest';
import { toProfileHistoryViewModel } from '@/features/profile/mappers/profile-history.mapper';

describe('toProfileHistoryViewModel', () => {
  it('maps user attempt history without deleted-quiz compatibility state', () => {
    expect(
      toProfileHistoryViewModel(
        {
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
          summary: { totalAttempts: 1, averageScore: 88, needsWorkCount: 0 },
        },
        'en',
      ),
    ).toEqual({
      attempts: [
        {
          id: 'attempt-1',
          score: 88,
          takenAt: '2026-07-02T00:00:00.000Z',
          takenAtLabel: 'Jul 2, 2026',
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

  it('omits an absent quiz description', () => {
    const result = toProfileHistoryViewModel(
      {
        attempts: [
          {
            id: 'attempt-1',
            score: 88,
            takenAt: '2026-07-02T00:00:00.000Z',
            totalQuestions: 10,
            quiz: { title: 'Algebra', slug: 'algebra' },
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
        summary: { totalAttempts: 1, averageScore: 88, needsWorkCount: 0 },
      },
      'en',
    );

    expect(result.attempts[0]?.quiz).not.toHaveProperty('description');
  });
});

describe('toProfileHistoryViewModel taken-at label', () => {
  const dto = {
    attempts: [
      {
        id: 'attempt-1',
        score: 5,
        takenAt: '2026-11-01T18:30:00.000Z',
        totalQuestions: 10,
        quiz: { title: 'Algebra', slug: 'algebra' },
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
    summary: { totalAttempts: 1, averageScore: 88, needsWorkCount: 0 },
  };

  it.each([
    ['vi', '02/11/2026'],
    ['en', 'Nov 2, 2026'],
  ])('follows the %s page locale', (locale, label) => {
    expect(toProfileHistoryViewModel(dto, locale).attempts[0]?.takenAtLabel).toBe(label);
  });

  it('carries the quick-round mode to a history item (RIN-936)', () => {
    const result = toProfileHistoryViewModel(
      {
        attempts: [
          {
            id: 'attempt-2',
            score: 70,
            takenAt: '2026-07-02T00:00:00.000Z',
            totalQuestions: 10,
            mode: 'quick',
            quiz: { title: 'Biology', slug: 'biology' },
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
        summary: { totalAttempts: 1, averageScore: 88, needsWorkCount: 0 },
      },
      'en',
    );

    expect(result.attempts[0]).toMatchObject({ mode: 'quick', totalQuestions: 10 });
  });
});
