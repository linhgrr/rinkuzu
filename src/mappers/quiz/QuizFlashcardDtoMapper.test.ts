import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { QuizFlashcardDtoMapper } from '@/mappers/quiz/QuizFlashcardDtoMapper';

const quiz: Quiz = {
  id: 'quiz-1',
  title: 'Algebra',
  slug: 'algebra',
  author: 'user-1',
  folder: null,
  questions: [
    {
      id: 'question-1',
      question: '2 + 2?',
      options: ['3', '4'],
      type: 'single',
      correctIndex: 1,
    },
  ],
  visibility: 'public',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('QuizFlashcardDtoMapper', () => {
  it('omits absent optional quiz and question media fields', () => {
    expect(QuizFlashcardDtoMapper.toDto(quiz)).toEqual({
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      questions: [
        {
          id: 'question-1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
    });
  });
});
