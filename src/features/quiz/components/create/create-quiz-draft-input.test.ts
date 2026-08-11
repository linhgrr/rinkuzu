import { describe, expect, it } from 'vitest';
import { toCreateQuizDraftInput } from './create-quiz-draft-input';

describe('toCreateQuizDraftInput', () => {
  it.each([true, false])('preserves isPrivate=%s in the draft request', (isPrivate) => {
    expect(
      toCreateQuizDraftInput(
        {
          aiPrompt: '  focus on definitions  ',
          description: '  Chapter one  ',
          isPrivate,
          selectedFolderId: 'folder-1',
          title: '  Biology  ',
        },
        { name: 'biology.pdf', size: 2048 },
        'uploads/user-1/biology.pdf',
      ),
    ).toEqual({
      title: 'Biology',
      s3Key: 'uploads/user-1/biology.pdf',
      fileName: 'biology.pdf',
      fileSize: 2048,
      folderId: 'folder-1',
      isPrivate,
      description: 'Chapter one',
      prompt: 'focus on definitions',
    });
  });

  it('omits blank optional text fields', () => {
    expect(
      toCreateQuizDraftInput(
        {
          aiPrompt: ' ',
          description: '',
          isPrivate: true,
          selectedFolderId: null,
          title: ' Quiz ',
        },
        { name: 'quiz.pdf', size: 1024 },
        'uploads/user-1/quiz.pdf',
      ),
    ).toEqual({
      title: 'Quiz',
      s3Key: 'uploads/user-1/quiz.pdf',
      fileName: 'quiz.pdf',
      fileSize: 1024,
      folderId: null,
      isPrivate: true,
    });
  });
});
