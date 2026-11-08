import { describe, expect, it } from 'vitest';
import {
  toProfileQuizLibraryViewModel,
  toProfileQuizMonthGroupsViewModel,
} from '@/features/profile/mappers/profile-quiz.mapper';

describe('toProfileQuizLibraryViewModel', () => {
  it('maps library DTOs to the profile quiz card contract', () => {
    expect(
      toProfileQuizLibraryViewModel({
        quizzes: [
          {
            id: 'quiz-1',
            title: 'Algebra',
            slug: 'algebra',
            description: 'Hidden from card',
            author: {
              id: 'user-1',
              displayName: 'Learner',
            },
            folder: null,
            questions: [],
            visibility: 'public',
            pdfUrl: 'https://example.com/source.pdf',
            questionCount: 12,
            ownedByMe: true,
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
            lastAttemptAt: null,
            lastProgressAt: null,
            libraryStatus: 'not_started',
            displayDate: '2026-07-01T00:00:00.000Z',
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 100,
          hasNextPage: false,
          hasPrevPage: false,
        },
        counts: { all: 1, inProgress: 0, complete: 1 },
      }),
    ).toEqual({
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Algebra',
          slug: 'algebra',
          author: {
            id: 'user-1',
            displayName: 'Learner',
          },
          visibility: 'public',
          questionCount: 12,
          ownedByMe: true,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
          libraryStatus: 'not_started',
          displayDate: '2026-07-01T00:00:00.000Z',
        },
      ],
      counts: { all: 1, inProgress: 0, complete: 1 },
      hasMore: false,
    });
  });

  it('maps quizzes into locale-aware month groups', () => {
    const groups = toProfileQuizMonthGroupsViewModel({
      locale: 'vi',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Algebra',
          slug: 'algebra',
          author: null,
          visibility: 'public',
          questionCount: 12,
          ownedByMe: true,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
          libraryStatus: 'not_started',
          displayDate: '2026-07-01T00:00:00.000Z',
        },
      ],
    });

    expect(groups).toEqual([
      {
        key: '2026-07-01',
        label: 'tháng 7 năm 2026',
        quizzes: [
          {
            id: 'quiz-1',
            title: 'Algebra',
            slug: 'algebra',
            author: null,
            visibility: 'public',
            questionCount: 12,
            ownedByMe: true,
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:00.000Z',
            libraryStatus: 'not_started',
            displayDate: '2026-07-01T00:00:00.000Z',
          },
        ],
      },
    ]);
  });
});
