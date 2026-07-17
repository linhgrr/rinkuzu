import { describe, expect, it } from 'vitest';
import { toFolderLibraryQuizViewModels } from '@/features/folders/mappers/folder.mapper';

describe('toFolderLibraryQuizViewModels', () => {
  it('omits an absent optional description', () => {
    const [result] = toFolderLibraryQuizViewModels({
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Algebra',
          slug: 'algebra',
          author: null,
          folder: null,
          questions: [],
          isPrivate: false,
          questionCount: 1,
          ownedByMe: true,
          createdAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T00:00:00.000Z',
          lastAttemptAt: null,
          lastProgressAt: null,
          libraryStatus: 'not_started',
          displayDate: '2026-07-02T00:00:00.000Z',
        },
      ],
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    expect(result).not.toHaveProperty('description');
  });
});
