import { describe, expect, it } from 'vitest';
import { AdminActivityDtoMapper } from '@/mappers/admin/AdminActivityDtoMapper';

describe('AdminActivityDtoMapper', () => {
  it('maps a registered user attempt and counts answered questions', () => {
    expect(
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-1',
        score: 80,
        takenAt: new Date('2026-06-28T00:00:00.000Z'),
        user: { id: 'user-1', email: 'learner@example.com' },
        quiz: { id: 'quiz-1', title: 'Algebra', slug: 'algebra' },
        answers: [1, -1, [0, 2], []],
        totalQuestions: 4,
      }),
    ).toEqual({
      id: 'attempt-1',
      score: 80,
      takenAt: '2026-06-28T00:00:00.000Z',
      answeredQuestions: 2,
      actor: { email: 'learner@example.com', type: 'user' },
      quiz: { title: 'Algebra' },
    });
  });

  it('maps a guest identity without pretending it is anonymous', () => {
    const dto = AdminActivityDtoMapper.toRecentAttempt({
      id: 'attempt-2',
      score: 0,
      takenAt: new Date('2026-06-27T00:00:00.000Z'),
      user: null,
      guestEmail: 'guest@example.com',
      quiz: { id: 'quiz-2', title: 'Guest Quiz', slug: 'guest-quiz' },
      answers: [-1],
      totalQuestions: 1,
    });

    expect(dto.actor).toEqual({
      email: 'guest@example.com',
      type: 'guest',
    });
    expect(dto.quiz).toEqual({ title: 'Guest Quiz' });
    expect(dto.answeredQuestions).toBe(0);
  });

  it('fails fast when attempt identity is missing', () => {
    expect(() =>
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-3',
        score: 0,
        takenAt: new Date('2026-06-27T00:00:00.000Z'),
        user: null,
        quiz: { id: 'quiz-3', title: 'Quiz', slug: 'quiz' },
        answers: [-1],
        totalQuestions: 1,
      }),
    ).toThrow('recentAttempt.actor is required');
  });

  it('fails fast when populated quiz snapshot is missing', () => {
    expect(() =>
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-4',
        score: 0,
        takenAt: new Date('2026-06-27T00:00:00.000Z'),
        user: { id: 'user-1', email: 'learner@example.com' },
        quiz: 'quiz-1',
        answers: [-1],
        totalQuestions: 1,
      }),
    ).toThrow('recentAttempt.quiz is required');
  });
});
