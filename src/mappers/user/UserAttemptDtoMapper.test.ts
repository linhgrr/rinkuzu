import { describe, expect, it } from 'vitest';
import type { Attempt } from '@/entities/Attempt';
import { UserAttemptDtoMapper } from '@/mappers/user/UserAttemptDtoMapper';

const attempt: Attempt = {
  id: 'attempt-1',
  user: 'user-1',
  quiz: {
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
      {
        id: 'question-2',
        question: 'Select primes',
        options: ['2', '3', '4'],
        type: 'multiple',
        correctIndexes: [0, 1],
      },
    ],
  },
  answers: [1, [1, 0]],
  score: 100,
  totalQuestions: 2,
  takenAt: new Date('2026-07-02T00:00:00Z'),
};

describe('UserAttemptDtoMapper', () => {
  it('maps populated attempts and evaluates answer correctness', () => {
    const dto = UserAttemptDtoMapper.toDetailDto(attempt);

    expect(dto.takenAt).toBe('2026-07-02T00:00:00.000Z');
    expect(dto.historyStatus).toBe('complete');
    expect(dto.totalQuestions).toBe(2);
    expect(dto.quiz.questions.map((question) => question.isCorrect)).toEqual([true, true]);
    expect(dto.quiz).not.toHaveProperty('description');
    const [singleQuestion, multipleQuestion] = dto.quiz.questions;
    if (!singleQuestion || !multipleQuestion) throw new Error('Expected two mapped questions');
    expect(singleQuestion).not.toHaveProperty('correctIndexes');
    expect(singleQuestion).not.toHaveProperty('questionImage');
    expect(singleQuestion).not.toHaveProperty('optionImages');
    expect(multipleQuestion).not.toHaveProperty('correctIndex');
  });

  it('maps the share facts and never marks a locked result shareable (RIN-1179)', () => {
    const fallback = UserAttemptDtoMapper.toDetailDto(attempt);
    const shared = UserAttemptDtoMapper.toDetailDto(attempt, false, null, {
      shareable: true,
      questionCount: 40,
    });
    const locked = UserAttemptDtoMapper.toDetailDto(attempt, true, null, {
      shareable: true,
      questionCount: 40,
    });

    expect(fallback.quiz).toMatchObject({ id: 'quiz-1', shareable: false, questionCount: 2 });
    expect(shared.quiz).toMatchObject({ id: 'quiz-1', shareable: true, questionCount: 40 });
    expect(locked.quiz.shareable).toBe(false);
  });

  it('omits an absent quiz description from summary DTOs', () => {
    expect(UserAttemptDtoMapper.toSummaryDto(attempt).quiz).not.toHaveProperty('description');
  });

  it('returns an explicit degraded history instead of misaligning changed quiz questions', () => {
    const dto = UserAttemptDtoMapper.toDetailDto({ ...attempt, answers: [1] });

    expect(dto).toMatchObject({
      historyStatus: 'quiz_modified',
      totalQuestions: 2,
      answers: [],
      quiz: { questions: [] },
    });
  });

  it('renders a quick round with its played questions, mode and indices (RIN-936)', () => {
    const quick: Attempt = { ...attempt, mode: 'quick', questionIndices: [17, 4] };

    const detail = UserAttemptDtoMapper.toDetailDto(quick);

    expect(detail).toMatchObject({
      mode: 'quick',
      questionIndices: [17, 4],
      historyStatus: 'complete',
      totalQuestions: 2,
    });
    expect(detail.quiz.questions.map((question) => question.id)).toEqual([
      'question-1',
      'question-2',
    ]);
    expect(UserAttemptDtoMapper.toSummaryDto(quick)).toMatchObject({ mode: 'quick' });
    expect(UserAttemptDtoMapper.toSummaryDto(attempt)).not.toHaveProperty('mode');
    expect(UserAttemptDtoMapper.toDetailDto(attempt)).not.toHaveProperty('mode');
  });
});
