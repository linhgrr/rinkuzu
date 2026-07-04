import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quizProgressMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/QuestionProgress', () => ({ default: {} }));
vi.mock('@/models/UserProgress', () => ({ default: {} }));
vi.mock('@/models/QuizProgress', () => ({
  default: { aggregate: quizProgressMocks.aggregate },
}));

import { DashboardRepository } from '@/repositories/DashboardRepository';

describe('DashboardRepository.findInProgressQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizProgressMocks.aggregate.mockResolvedValue([]);
  });

  it('loads in-progress quiz summaries in one aggregation without saved answers', async () => {
    const userId = '507f191e810c19729de860ea';
    const repository = new DashboardRepository();

    await expect(repository.findInProgressQuizzes(userId, 6)).resolves.toEqual([]);

    expect(quizProgressMocks.aggregate).toHaveBeenCalledWith([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $sort: { updatedAt: -1 } },
      { $limit: 6 },
      {
        $lookup: {
          from: 'quizzes',
          localField: 'quiz',
          foreignField: '_id',
          as: 'quizDoc',
        },
      },
      { $unwind: '$quizDoc' },
      {
        $project: {
          answeredCount: 1,
          totalQuestions: 1,
          updatedAt: 1,
          quiz: {
            _id: '$quizDoc._id',
            title: '$quizDoc.title',
            slug: '$quizDoc.slug',
          },
        },
      },
    ]);
  });
});
