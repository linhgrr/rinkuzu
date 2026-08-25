import { describe, expect, it } from 'vitest';
import type { LibraryQuiz, QuestionReviewProgress } from '@/entities/LearningProgress';
import { LearningProgressDtoMapper } from '@/mappers/learning/LearningProgressDtoMapper';

const now = new Date('2026-06-30T10:00:00.000Z');

function libraryQuiz(overrides: Partial<LibraryQuiz> = {}): LibraryQuiz {
  return {
    id: 'quiz-1',
    title: 'Algorithms',
    slug: 'algorithms',
    description: 'Practice',
    author: {
      id: 'user-1',
      displayName: 'Quang',
    },
    folder: null,
    visibility: 'public',
    pdfUrl: 'https://example.test/source.pdf',
    questionCount: 2,
    ownedByMe: true,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: null,
    lastProgressAt: now,
    libraryStatus: 'in_progress',
    displayDate: now.toISOString(),
    ...overrides,
  };
}

function dueQuestion(overrides: Partial<QuestionReviewProgress> = {}): QuestionReviewProgress {
  return {
    id: 'progress-1',
    userId: 'user-1',
    quizSlug: 'algorithms',
    questionId: 'q1',
    questionRef: {
      text: '2 + 2?',
      options: ['3', '4'],
      correctIndexes: [1],
    },
    srsLevel: 1,
    nextReviewDate: now,
    lastReviewDate: null,
    interval: 1,
    easeFactor: 2.5,
    correctStreak: 1,
    totalReviews: 1,
    totalCorrect: 1,
    history: [{ date: now, rating: 'good' }],
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('LearningProgressDtoMapper', () => {
  it('maps library quiz DTO without leaking persistence fields', () => {
    const dto = LearningProgressDtoMapper.toLibraryQuizDto(libraryQuiz());

    expect(dto).toEqual(
      expect.objectContaining({
        id: 'quiz-1',
        title: 'Algorithms',
        slug: 'algorithms',
        questions: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        lastProgressAt: now.toISOString(),
      }),
    );
    expect(dto).not.toHaveProperty('_id');
    expect(dto.author).not.toHaveProperty('email');
    expect(JSON.stringify(dto.author)).not.toMatch(/"email"/);
  });

  it('maps due review questions with id and serialized dates', () => {
    const dto = LearningProgressDtoMapper.toDueQuestionDto(dueQuestion());

    expect(dto).toEqual(
      expect.objectContaining({
        id: 'progress-1',
        nextReviewDate: now.toISOString(),
        lastReviewDate: null,
        history: [{ date: now.toISOString(), rating: 'good' }],
      }),
    );
    expect(dto).not.toHaveProperty('_id');
  });

  it('omits absent optional library and review fields', () => {
    const quiz = libraryQuiz();
    delete quiz.description;
    delete quiz.pdfUrl;
    const question = dueQuestion();
    delete question.questionRef;

    const quizDto = LearningProgressDtoMapper.toLibraryQuizDto(quiz);
    const questionDto = LearningProgressDtoMapper.toDueQuestionDto(question);

    expect(quizDto).not.toHaveProperty('description');
    expect(quizDto).not.toHaveProperty('pdfUrl');
    expect(questionDto).not.toHaveProperty('questionRef');
  });
});
