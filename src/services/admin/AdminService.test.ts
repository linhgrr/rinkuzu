import { describe, expect, it } from 'vitest';
import { normalizeAdminRecentAttempt } from './adminActivity';

describe('normalizeAdminRecentAttempt', () => {
  it('keeps populated quiz and user details', () => {
    const takenAt = new Date('2026-06-28T00:00:00.000Z');

    expect(
      normalizeAdminRecentAttempt({
        _id: 'attempt-1',
        score: 80,
        takenAt,
        user: { email: 'learner@example.com' },
        quiz: { title: 'Algebra' },
      }),
    ).toEqual({
      id: 'attempt-1',
      score: 80,
      takenAt,
      user: { email: 'learner@example.com' },
      quiz: { title: 'Algebra' },
    });
  });

  it('normalizes orphaned quiz references to null', () => {
    expect(
      normalizeAdminRecentAttempt({
        _id: 'attempt-2',
        score: 60,
        takenAt: new Date('2026-06-27T00:00:00.000Z'),
        user: null,
        quiz: null,
      }),
    ).toMatchObject({
      id: 'attempt-2',
      score: 60,
      user: null,
      quiz: null,
    });
  });
});
