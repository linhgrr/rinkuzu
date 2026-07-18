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
          pipeline: [{ $project: { _id: 1, title: 1, slug: 1 } }],
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

  it('projects only _id, title, and slug inside the quizzes lookup before unwind', async () => {
    const userId = '507f191e810c19729de860ea';
    const repository = new DashboardRepository();

    await repository.findInProgressQuizzes(userId, 6);

    const pipeline = quizProgressMocks.aggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(pipeline).toBeDefined();

    const lookupIndex = pipeline.findIndex(
      (stage) =>
        typeof stage === 'object' &&
        stage !== null &&
        '$lookup' in stage &&
        (stage['$lookup'] as { from?: string }).from === 'quizzes',
    );
    expect(lookupIndex).toBeGreaterThanOrEqual(0);

    const unwindIndex = pipeline.findIndex(
      (stage) =>
        typeof stage === 'object' &&
        stage !== null &&
        '$unwind' in stage &&
        stage['$unwind'] === '$quizDoc',
    );
    expect(unwindIndex).toBeGreaterThan(lookupIndex);

    const lookupStage = pipeline[lookupIndex]?.['$lookup'] as {
      from: string;
      localField: string;
      foreignField: string;
      pipeline: Array<{ $project: Record<string, number> }>;
      as: string;
    };

    expect(lookupStage.pipeline).toEqual([{ $project: { _id: 1, title: 1, slug: 1 } }]);
    expect(lookupStage.pipeline[0]?.$project).toEqual({ _id: 1, title: 1, slug: 1 });
    expect(Object.keys(lookupStage.pipeline[0]?.$project ?? {})).toEqual(['_id', 'title', 'slug']);
  });

  it('returns an empty list for invalid user ids without aggregating', async () => {
    const repository = new DashboardRepository();

    await expect(repository.findInProgressQuizzes('not-a-valid-object-id', 6)).resolves.toEqual([]);

    expect(quizProgressMocks.aggregate).not.toHaveBeenCalled();
  });
});
