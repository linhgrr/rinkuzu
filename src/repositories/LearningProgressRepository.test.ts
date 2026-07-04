import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  attemptAggregate: vi.fn(),
  quizAggregate: vi.fn(),
  quizProgressAggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Attempt', () => ({
  default: { aggregate: modelMocks.attemptAggregate },
}));
vi.mock('@/models/QuestionProgress', () => ({ default: {} }));
vi.mock('@/models/Quiz', () => ({
  default: { aggregate: modelMocks.quizAggregate },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { aggregate: modelMocks.quizProgressAggregate },
}));
vi.mock('@/models/UserProgress', () => ({ default: {} }));

import { LearningProgressRepository } from '@/repositories/LearningProgressRepository';

describe('LearningProgressRepository.listLibraryQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.quizAggregate.mockResolvedValue([{ items: [], meta: [{ totalItems: 0 }] }]);
  });

  it('builds the user library in one aggregation without duplicate activity scans', async () => {
    const repository = new LearningProgressRepository();

    await expect(
      repository.listLibraryQuizzes('507f191e810c19729de860ea', {
        page: 1,
        limit: 20,
      }),
    ).resolves.toMatchObject({
      items: [],
      pagination: {
        currentPage: 1,
        totalItems: 0,
        itemsPerPage: 20,
      },
    });

    expect(modelMocks.attemptAggregate).not.toHaveBeenCalled();
    expect(modelMocks.quizProgressAggregate).not.toHaveBeenCalled();
    expect(modelMocks.quizAggregate).toHaveBeenCalledOnce();

    const pipeline = modelMocks.quizAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(
      pipeline
        .filter((stage) => '$unionWith' in stage)
        .map((stage) => (stage['$unionWith'] as { coll: string }).coll),
    ).toEqual(['attempts', 'quizprogresses']);
    expect(pipeline).toContainEqual({
      $facet: expect.objectContaining({
        items: expect.arrayContaining([{ $skip: 0 }, { $limit: 20 }]),
        meta: [{ $count: 'totalItems' }],
      }),
    });

    const replaceRootIndex = pipeline.findIndex((stage) => '$replaceRoot' in stage);
    const folderLookupIndex = pipeline.findIndex(
      (stage) => (stage['$lookup'] as { from?: string } | undefined)?.from === 'folderquizzes',
    );

    expect(pipeline.slice(replaceRootIndex + 1, folderLookupIndex)).toEqual([
      { $addFields: { questionCount: { $size: { $ifNull: ['$questions', []] } } } },
      { $project: { questions: 0 } },
    ]);
  });
});
