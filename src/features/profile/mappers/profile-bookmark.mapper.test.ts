import { describe, expect, it } from 'vitest';
import { toProfileBookmarkListViewModel } from '@/features/profile/mappers/profile-bookmark.mapper';

const emptyPagination = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 1,
  itemsPerPage: 10,
  hasNextPage: false,
  hasPrevPage: false,
} as const;

describe('toProfileBookmarkListViewModel', () => {
  it('maps bookmark API data to profile bookmark UI model', () => {
    expect(
      toProfileBookmarkListViewModel(
        {
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
          pagination: { ...emptyPagination },
        },
        'en',
      ),
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
            questionImage: 'https://example.com/question.png',
            optionImages: [undefined, 'https://example.com/answer.png'],
          },
          questionIndex: 0,
          createdAt: '2026-07-02T00:00:00.000Z',
          createdAtLabel: 'Jul 2, 2026',
          updatedAt: '2026-07-02T01:00:00.000Z',
          updatedAtLabel: 'Jul 2, 2026',
        },
      ],
      pagination: { ...emptyPagination },
    });
  });

  it('retains defined 0 / empty-array values and omits undefined optional keys', () => {
    const result = toProfileBookmarkListViewModel(
      {
        bookmarks: [
          {
            id: 'bookmark-zero',
            quiz: {
              slug: 'zero-index',
              title: 'Zero Index',
            },
            question: {
              text: 'Pick none?',
              options: ['A', 'B'],
              type: 'multiple',
              correctIndex: 0,
              correctIndexes: [],
              questionImage: undefined,
              optionImages: [],
            },
            questionIndex: 0,
            createdAt: '2026-07-02T00:00:00.000Z',
          },
        ],
        pagination: { ...emptyPagination, totalItems: 1 },
      },
      'en',
    );

    expect(result.bookmarks).toHaveLength(1);
    const [mapped] = result.bookmarks;
    expect(mapped.quiz).toEqual({
      slug: 'zero-index',
      title: 'Zero Index',
    });
    expect(mapped.quiz).not.toHaveProperty('description');
    expect(mapped.question).toEqual({
      text: 'Pick none?',
      options: ['A', 'B'],
      type: 'multiple',
      correctIndex: 0,
      correctIndexes: [],
      optionImages: [],
    });
    expect(mapped.question).not.toHaveProperty('questionImage');
    expect(mapped).not.toHaveProperty('updatedAt');
    expect(mapped).not.toHaveProperty('updatedAtLabel');
  });
});

describe('toProfileBookmarkListViewModel date labels', () => {
  const dto = {
    bookmarks: [
      {
        id: 'bookmark-1',
        quiz: { slug: 'algebra', title: 'Algebra' },
        question: { text: '2 + 2?', options: ['3', '4'], type: 'single' as const },
        questionIndex: 0,
        createdAt: '2026-11-01T18:30:00.000Z',
        updatedAt: '2026-11-01T18:30:00.000Z',
      },
    ],
    pagination: { ...emptyPagination },
  };

  it.each([
    ['vi', '02/11/2026'],
    ['en', 'Nov 2, 2026'],
  ])('follows the %s page locale', (locale, label) => {
    const [mapped] = toProfileBookmarkListViewModel(dto, locale).bookmarks;
    expect(mapped?.createdAtLabel).toBe(label);
    expect(mapped?.updatedAtLabel).toBe(label);
  });
});
