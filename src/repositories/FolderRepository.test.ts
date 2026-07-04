import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  attemptAggregate: vi.fn(),
  folderAggregate: vi.fn(),
  folderQuizAggregate: vi.fn(),
  folderQuizFind: vi.fn(),
  quizCountDocuments: vi.fn(),
  quizFind: vi.fn(),
  quizProgressAggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/models/Attempt', () => ({
  default: { aggregate: modelMocks.attemptAggregate },
}));
vi.mock('@/models/Folder', () => ({
  default: { aggregate: modelMocks.folderAggregate },
}));
vi.mock('@/models/FolderQuiz', () => ({
  default: {
    aggregate: modelMocks.folderQuizAggregate,
    find: modelMocks.folderQuizFind,
  },
}));
vi.mock('@/models/Quiz', () => ({
  default: {
    countDocuments: modelMocks.quizCountDocuments,
    find: modelMocks.quizFind,
  },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { aggregate: modelMocks.quizProgressAggregate },
}));

import { FolderRepository } from '@/repositories/FolderRepository';

describe('FolderRepository.listOverviewByOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.folderAggregate.mockResolvedValue([]);
    modelMocks.quizCountDocuments.mockResolvedValue(2);
    modelMocks.folderQuizAggregate.mockResolvedValue([]);
    modelMocks.attemptAggregate.mockResolvedValue([{ count: 3 }]);
  });

  it('computes external unfiled quizzes in the first parallel query phase', async () => {
    const repository = new FolderRepository();

    await expect(repository.listOverviewByOwner('507f191e810c19729de860ea')).resolves.toEqual({
      folders: [],
      unfiledCount: 5,
    });

    expect(modelMocks.quizFind).not.toHaveBeenCalled();
    expect(modelMocks.folderQuizFind).not.toHaveBeenCalled();
    expect(modelMocks.quizProgressAggregate).not.toHaveBeenCalled();

    const pipeline = modelMocks.attemptAggregate.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;
    expect(pipeline).toContainEqual({
      $unionWith: expect.objectContaining({ coll: 'quizprogresses' }),
    });
    expect(pipeline.at(-1)).toEqual({ $count: 'count' });
  });
});
