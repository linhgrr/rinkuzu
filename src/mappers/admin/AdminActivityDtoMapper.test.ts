import { describe, expect, it } from 'vitest';
import { AdminActivityDtoMapper } from '@/mappers/admin/AdminActivityDtoMapper';

describe('AdminActivityDtoMapper', () => {
  it('maps a registered user attempt read model', () => {
    expect(
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-1',
        score: 80,
        takenAt: new Date('2026-06-28T00:00:00.000Z'),
        userEmail: 'learner@example.com',
        quizTitle: 'Algebra',
        answeredQuestions: 2,
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
      guestEmail: 'guest@example.com',
      quizTitle: 'Guest Quiz',
      answeredQuestions: 0,
    });

    expect(dto.actor).toEqual({
      email: 'guest@example.com',
      type: 'guest',
    });
    expect(dto.quiz).toEqual({ title: 'Guest Quiz' });
    expect(dto.answeredQuestions).toBe(0);
  });

  it('maps a claim-token guest as a guest with no email (RIN-912)', () => {
    const dto = AdminActivityDtoMapper.toRecentAttempt({
      id: 'attempt-4',
      score: 50,
      takenAt: new Date('2026-11-05T00:00:00.000Z'),
      isClaimTokenGuest: true,
      quizTitle: 'Token Quiz',
      answeredQuestions: 1,
    });

    expect(dto.actor).toEqual({ type: 'guest' });
  });

  it('fails fast when attempt identity is missing', () => {
    expect(() =>
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-3',
        score: 0,
        takenAt: new Date('2026-06-27T00:00:00.000Z'),
        quizTitle: 'Quiz',
        answeredQuestions: 0,
      }),
    ).toThrow('recentAttempt.actor is required');
  });

  it('fails fast when populated quiz snapshot is missing', () => {
    expect(() =>
      AdminActivityDtoMapper.toRecentAttempt({
        id: 'attempt-4',
        score: 0,
        takenAt: new Date('2026-06-27T00:00:00.000Z'),
        userEmail: 'learner@example.com',
        answeredQuestions: 0,
      }),
    ).toThrow('recentAttempt.quiz is required');
  });
});
