import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { checkQuizSourceAccess } from './quiz-helpers';

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: '507f191e810c19729de860ea',
    title: 'Personal source',
    slug: 'personal-source',
    author: '507f191e810c19729de860eb',
    questions: [],
    visibility: 'personal',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('checkQuizSourceAccess', () => {
  it('allows public quizzes', async () => {
    await expect(checkQuizSourceAccess(quiz({ visibility: 'public' }))).resolves.toBeNull();
  });

  it('requires authentication for personal sources', async () => {
    await expect(checkQuizSourceAccess(quiz())).resolves.toEqual({
      success: false,
      error: 'Authentication required to access personal quiz source',
      statusCode: 401,
    });
  });

  it.each([
    ['author', 'user', '507f191e810c19729de860eb'],
    ['admin', 'admin', '507f191e810c19729de860ec'],
  ])('allows the %s', async (_label, role, userId) => {
    await expect(checkQuizSourceAccess(quiz(), userId, role)).resolves.toBeNull();
  });

  it('never exposes a personal source to another user, including Premium users', async () => {
    await expect(
      checkQuizSourceAccess(quiz(), '507f191e810c19729de860ec', 'user'),
    ).resolves.toEqual({
      success: false,
      error: 'Personal quiz sources are only available to their owner or an admin',
      statusCode: 403,
    });
  });
});
