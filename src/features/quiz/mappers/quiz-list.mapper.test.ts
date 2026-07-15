import { describe, expect, it } from 'vitest';
import { toQuizListViewModel } from '@/features/quiz/mappers/quiz-list.mapper';

describe('toQuizListViewModel', () => {
  it('maps transport quiz and pagination fields into the feature view model', () => {
    const result = toQuizListViewModel({
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Architecture',
          slug: 'architecture',
          author: {
            id: 'user-1',
            email: 'author@example.com',
            displayName: 'Author',
          },
          folder: 'folder-1',
          isPrivate: false,
          questionCount: 10,
          createdAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T01:00:00.000Z',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 20,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });

    expect(result).toEqual({
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Architecture',
          slug: 'architecture',
          author: {
            id: 'user-1',
            email: 'author@example.com',
            name: undefined,
            displayName: 'Author',
            avatar: undefined,
          },
          folderId: 'folder-1',
          isPrivate: false,
          questionCount: 10,
          createdAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T01:00:00.000Z',
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 20,
        itemsPerPage: 10,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });
    expect(result.quizzes[0]).not.toHaveProperty('description');
  });
});
