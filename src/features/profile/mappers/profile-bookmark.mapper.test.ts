import { describe, expect, it } from 'vitest';
import { toProfileBookmarkListViewModel } from '@/features/profile/mappers/profile-bookmark.mapper';

describe('toProfileBookmarkListViewModel', () => {
  it('maps bookmark API data to profile bookmark UI model', () => {
    expect(
      toProfileBookmarkListViewModel({
        bookmarks: [
          {
            id: 'bookmark-1',
            quiz: {
              slug: 'algebra',
              title: 'Algebra',
              description: 'Linear equations',
            },
            question: {
              text: '2 + 2?',
              options: ['3', '4'],
              type: 'single',
              correctIndex: 1,
              questionImage: 'https://example.com/question.png',
              optionImages: [undefined, 'https://example.com/answer.png'],
            },
            questionIndex: 0,
            createdAt: '2026-07-02T00:00:00.000Z',
            updatedAt: '2026-07-02T01:00:00.000Z',
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
      bookmarks: [
        {
          id: 'bookmark-1',
          quiz: {
            slug: 'algebra',
            title: 'Algebra',
            description: 'Linear equations',
          },
          question: {
            text: '2 + 2?',
            options: ['3', '4'],
            type: 'single',
            correctIndex: 1,
            correctIndexes: undefined,
            questionImage: 'https://example.com/question.png',
            optionImages: [undefined, 'https://example.com/answer.png'],
          },
          questionIndex: 0,
          createdAt: '2026-07-02T00:00:00.000Z',
          createdAtLabel: '07/02/2026',
          updatedAt: '2026-07-02T01:00:00.000Z',
          updatedAtLabel: '07/02/2026',
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
