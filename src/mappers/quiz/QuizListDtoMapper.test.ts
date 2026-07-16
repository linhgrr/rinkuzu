import { describe, expect, it } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';

const quiz: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: '507f191e810c19729de860eb',
    email: 'teacher@example.com',
    name: 'Teacher',
    displayName: 'Math Teacher',
    avatar: 'https://example.com/avatar.png',
  },
  folder: '507f191e810c19729de860ec',
  questions: [
    {
      id: '507f191e810c19729de860ed',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndex: 1,
      type: 'single',
    },
  ],
  isPrivate: false,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

describe('QuizListDtoMapper', () => {
  it('maps quiz list items to public DTO identity and date fields', () => {
    expect(QuizListDtoMapper.toListItem(quiz)).toEqual({
      id: '507f191e810c19729de860ea',
      title: 'Algebra Basics',
      description: 'Linear equations',
      slug: 'algebra-basics',
      author: {
        id: '507f191e810c19729de860eb',
        name: 'Teacher',
        displayName: 'Math Teacher',
        avatar: 'https://example.com/avatar.png',
      },
      folder: '507f191e810c19729de860ec',
      isPrivate: false,
      questionCount: 1,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T01:00:00.000Z',
    });
  });

  it('does not expose persistence identity keys in the DTO shape', () => {
    const dto = QuizListDtoMapper.toListItem(quiz);

    expect(dto).not.toHaveProperty('_id');
    expect(typeof dto.author === 'object' ? dto.author : null).not.toHaveProperty('_id');
  });

  it('does not expose author email in catalog metadata', () => {
    const dto = QuizListDtoMapper.toListItem(quiz);

    expect(dto.author).not.toHaveProperty('email');
  });
});
