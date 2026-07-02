import { describe, expect, it } from 'vitest';
import { AttemptPersistenceMapper } from '@/repositories/mappers/AttemptPersistenceMapper';

describe('AttemptPersistenceMapper', () => {
  it('maps populated persistence records to an attempt entity', () => {
    const takenAt = new Date('2026-07-01T14:57:31.432Z');

    expect(
      AttemptPersistenceMapper.toEntity({
        _id: 'attempt-1',
        user: {
          _id: 'user-1',
          email: 'learner@example.com',
        },
        quiz: {
          _id: 'quiz-1',
          title: 'Software Engineering',
          slug: 'software-engineering',
          questions: [
            {
              _id: 'question-1',
              question: 'What is cohesion?',
              options: ['A', 'B'],
              correctIndex: 0,
              type: 'single',
            },
          ],
        },
        answers: [{ kind: 'single', selectedIndex: 0 }],
        score: 100,
        totalQuestions: 1,
        takenAt,
      }),
    ).toEqual({
      id: 'attempt-1',
      user: {
        id: 'user-1',
        email: 'learner@example.com',
      },
      guestEmail: undefined,
      quiz: {
        id: 'quiz-1',
        title: 'Software Engineering',
        slug: 'software-engineering',
        description: undefined,
        questions: [
          {
            id: 'question-1',
            question: 'What is cohesion?',
            options: ['A', 'B'],
            correctIndex: 0,
            correctIndexes: undefined,
            type: 'single',
            questionImage: undefined,
            optionImages: undefined,
          },
        ],
      },
      answers: [0],
      score: 100,
      totalQuestions: 1,
      takenAt,
    });
  });

  it('keeps guest identity separate from registered user identity', () => {
    const attempt = AttemptPersistenceMapper.toEntity({
      _id: 'attempt-2',
      guestEmail: 'guest@example.com',
      quiz: 'quiz-1',
      answers: [{ kind: 'single', selectedIndex: null }],
      score: 0,
      totalQuestions: 1,
      takenAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(attempt.user).toBeNull();
    expect(attempt.guestEmail).toBe('guest@example.com');
    expect(attempt.quiz).toBe('quiz-1');
  });

  it('maps multiple-choice persistence answers back to entity answers', () => {
    const attempt = AttemptPersistenceMapper.toEntity({
      _id: 'attempt-3',
      user: 'user-1',
      quiz: 'quiz-1',
      answers: [{ kind: 'multiple', selectedIndexes: [0, 2] }],
      score: 100,
      totalQuestions: 1,
      takenAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(attempt.answers).toEqual([[0, 2]]);
  });
});
