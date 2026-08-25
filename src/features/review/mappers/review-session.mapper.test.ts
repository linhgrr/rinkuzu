import { describe, expect, it } from 'vitest';
import {
  toReviewQuestionViewModels,
  toReviewSubmitPayload,
  toReviewSubmitResultViewModel,
} from './review-session.mapper';
import type { DueReviewQuestionDto } from '@/dtos/review';

const dueQuestion: DueReviewQuestionDto = {
  id: 'progress-1',
  userId: 'user-1',
  quizSlug: 'intro-quiz',
  questionId: 'q1',
  questionRef: {
    text: 'What is 2 + 2?',
    options: ['3', '4'],
    correctIndexes: [1],
  },
  srsLevel: 1,
  nextReviewDate: '2026-07-02T00:00:00.000Z',
  lastReviewDate: null,
  interval: 1,
  easeFactor: 2.5,
  correctStreak: 0,
  totalReviews: 0,
  totalCorrect: 0,
  history: [],
  notes: '',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const { questionRef: _questionRef, ...dueQuestionWithoutRef } = dueQuestion;

describe('review-session.mapper', () => {
  it('maps due review lists to displayable view models only', () => {
    expect(
      toReviewQuestionViewModels({
        questions: [dueQuestion, { ...dueQuestionWithoutRef, id: 'missing-ref' }],
        count: 2,
      }),
    ).toEqual([
      {
        id: 'progress-1',
        quizSlug: 'intro-quiz',
        questionId: 'q1',
        questionRef: {
          text: 'What is 2 + 2?',
          options: ['3', '4'],
          correctIndexes: [1],
        },
      },
    ]);
  });

  it('builds the submit request DTO from the view model and rating', () => {
    const [viewModel] = toReviewQuestionViewModels({
      questions: [dueQuestion],
      count: 1,
    });
    if (!viewModel) throw new Error('Expected mapper to return a review question view model');

    expect(toReviewSubmitPayload(viewModel, 'good')).toEqual({
      questionId: 'q1',
      quizSlug: 'intro-quiz',
      rating: 'good',
      questionRef: dueQuestion.questionRef,
    });
  });

  it('maps submit response to the review result view model', () => {
    expect(
      toReviewSubmitResultViewModel({
        questionProgress: dueQuestion,
        userProgress: {
          xp: 120,
          streak: 3,
          xpGained: 10,
          streakFreezeUsed: false,
        },
      }),
    ).toEqual({ xpGained: 10 });
  });
});
