import { describe, expect, it } from 'vitest';
import { toFolderLibraryQuizViewModel } from '@/features/folders/mappers/folder.mapper';

describe('toFolderLibraryQuizViewModel', () => {
  it('omits an absent optional description', () => {
    const result = toFolderLibraryQuizViewModel({
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
    });

    expect(result).not.toHaveProperty('description');
  });
});
