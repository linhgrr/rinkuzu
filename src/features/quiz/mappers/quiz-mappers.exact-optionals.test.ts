import { describe, expect, it } from 'vitest';
import { toFlashcardQuizViewModel } from '@/features/quiz/mappers/flashcard.mapper';
import { toQuizEditViewModel } from '@/features/quiz/mappers/quiz-editor.mapper';
import { toQuizDiscussionViewModel } from '@/features/quiz/mappers/quiz-interaction.mapper';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';

describe('quiz mapper optional fields', () => {
  it('omits absent flashcard media and description fields', () => {
    const result = toFlashcardQuizViewModel({
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      questions: [
        {
          id: 'q1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
    });

    expect(result).not.toHaveProperty('description');
    expect(result.questions[0]).not.toHaveProperty('questionImage');
    expect(result.questions[0]).not.toHaveProperty('correctIndexes');
  });

  it('omits absent quiz edit and play optional fields', () => {
    const base = {
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      author: null,
      folder: null,
      visibility: 'public' as const,
      questionCount: 1,
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    };
    const editor = toQuizEditViewModel({
      ...base,
      questions: [
        {
          id: 'q1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
    });
    const play = toQuizPlayViewModel({
      ...base,
      questions: [
        {
          id: 'q1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
        },
      ],
    });

    for (const result of [editor, play]) {
      expect(result).not.toHaveProperty('description');
      expect(result).not.toHaveProperty('pdfUrl');
      expect(result).not.toHaveProperty('tags');
      expect(result.questions[0]).not.toHaveProperty('questionImage');
    }
  });

  it('omits an absent discussion update timestamp', () => {
    const result = toQuizDiscussionViewModel({
      id: 'discussion-1',
      questionIndex: 0,
      comments: [
        {
          id: 'comment-1',
          author: { id: 'user-1', name: 'Learner' },
          content: 'Explain?',
          isEdited: false,
          createdAt: '2026-07-02T00:00:00.000Z',
        },
      ],
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(result.comments[0]).not.toHaveProperty('updatedAt');
  });
});
