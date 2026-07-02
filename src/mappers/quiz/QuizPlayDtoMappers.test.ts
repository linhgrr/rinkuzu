import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { QuizProgress } from '@/entities/QuizProgress';
import { QuizAttemptDtoMapper } from '@/mappers/quiz/QuizAttemptDtoMapper';
import { QuizFlashcardDtoMapper } from '@/mappers/quiz/QuizFlashcardDtoMapper';
import { QuizProgressDtoMapper } from '@/mappers/quiz/QuizProgressDtoMapper';

describe('quiz play DTO mappers', () => {
  it('maps saved progress and attempt results', () => {
    const progress: QuizProgress = {
      id: 'progress-1',
      userId: 'user-1',
      quiz: 'quiz-1',
      questionOrder: [1, 0],
      optionOrders: [
        [1, 0],
        [0, 1],
      ],
      userAnswers: [1, [0, 1]],
      currentQuestionIndex: 1,
      answeredCount: 2,
      totalQuestions: 2,
      updatedAt: new Date('2026-07-02T00:00:00Z'),
    };

    expect(QuizProgressDtoMapper.toGetResponse(progress)).toEqual({
      progress: {
        questionOrder: [1, 0],
        optionOrders: [
          [1, 0],
          [0, 1],
        ],
        userAnswers: [1, [0, 1]],
        currentQuestionIndex: 1,
        answeredCount: 2,
        totalQuestions: 2,
      },
    });
    expect(QuizProgressDtoMapper.toGetResponse(null)).toEqual({ progress: null });
    expect(QuizAttemptDtoMapper.toResultDto('attempt-1', 80, 4, 5)).toEqual({
      attemptId: 'attempt-1',
      score: 80,
      correctAnswers: 4,
      totalQuestions: 5,
    });
  });

  it('maps quiz questions to flashcard DTOs', () => {
    const quiz: Quiz = {
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      author: 'user-1',
      isPrivate: false,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
      createdAt: new Date('2026-07-02T00:00:00Z'),
      updatedAt: new Date('2026-07-02T00:00:00Z'),
    };

    expect(QuizFlashcardDtoMapper.toDto(quiz)).toEqual({
      id: 'quiz-1',
      title: 'Algebra',
      slug: 'algebra',
      description: undefined,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
          correctIndexes: undefined,
          questionImage: undefined,
          optionImages: undefined,
        },
      ],
    });
  });
});
