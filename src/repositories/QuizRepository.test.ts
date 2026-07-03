import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const quizModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Quiz', () => ({
  default: {
    aggregate: quizModelMocks.aggregate,
    countDocuments: quizModelMocks.countDocuments,
  },
}));

import { QuizRepository } from '@/repositories/QuizRepository';

describe('QuizRepository.findUserQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizModelMocks.aggregate.mockResolvedValue([
      {
        _id: new Types.ObjectId('507f191e810c19729de860ea'),
        title: 'Algebra Basics',
        description: 'Linear equations',
        slug: 'algebra-basics',
        author: new Types.ObjectId('507f191e810c19729de860eb'),
        folder: null,
        questions: [],
        questionCount: 12,
        isPrivate: false,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T01:00:00.000Z'),
      },
    ]);
    quizModelMocks.countDocuments.mockResolvedValue(1);
  });

  it('projects user quiz list rows without loading question payloads', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    const result = await repository.findUserQuizzes(userId, { page: 2, limit: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: '507f191e810c19729de860ea',
      questionCount: 12,
      questions: [],
    });
    expect(result.pagination).toMatchObject({
      currentPage: 2,
      totalItems: 1,
      itemsPerPage: 10,
    });
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
      { $match: { author: new Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      { $skip: 10 },
      { $limit: 10 },
      {
        $project: expect.objectContaining({
          questions: { $literal: [] },
          questionCount: { $size: { $ifNull: ['$questions', []] } },
        }),
      },
    ]);
    expect(quizModelMocks.countDocuments).toHaveBeenCalledWith({
      author: new Types.ObjectId(userId),
    });
  });
});
