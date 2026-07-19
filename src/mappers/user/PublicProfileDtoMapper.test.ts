import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { PublicProfileUser } from '@/entities/User';
import { PublicProfileDtoMapper } from '@/mappers/user/PublicProfileDtoMapper';

const user: PublicProfileUser = {
  id: '507f191e810c19729de860ea',
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
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 12,
      hasNextPage: false,
      hasPrevPage: false,
    };

    expect(PublicProfileDtoMapper.toDto(user, [], pagination).user.id).toBe(user.id);
    expect(PublicProfileDtoMapper.toDto(user, [quiz], pagination)).toMatchObject({
      quizzes: [{ id: quiz.id }],
      pagination,
    });
  });

  it('never emits email on the public profile user tree', () => {
    const pagination = {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 12,
      hasNextPage: false,
      hasPrevPage: false,
    };
    const dto = PublicProfileDtoMapper.toDto(user, [], pagination);

    expect(dto.user).not.toHaveProperty('email');
    expect(JSON.stringify(dto.user)).not.toMatch(/"email"/);
  });
});
