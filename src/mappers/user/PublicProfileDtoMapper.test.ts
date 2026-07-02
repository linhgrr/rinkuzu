import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { PublicProfileUser } from '@/entities/User';
import { PublicProfileDtoMapper } from '@/mappers/user/PublicProfileDtoMapper';

const user: PublicProfileUser = {
  id: '507f191e810c19729de860ea',
  email: 'learner@example.com',
  displayName: 'Learner',
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

const quiz: Quiz = {
  id: '507f191e810c19729de860eb',
  title: 'Public quiz',
  slug: 'public-quiz',
  author: user.id,
  questions: [],
  isPrivate: false,
  createdAt: new Date('2026-07-02T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
};

describe('PublicProfileDtoMapper', () => {
  it('maps stable identity and date fields', () => {
    expect(PublicProfileDtoMapper.toDto(user, []).user.id).toBe(user.id);
    expect(PublicProfileDtoMapper.toDto(user, [quiz]).quizzes[0]?.id).toBe(quiz.id);
  });
});
