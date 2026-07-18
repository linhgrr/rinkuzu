import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { FolderNameConflictError } from '@/entities/Folder';

const modelMocks = vi.hoisted(() => ({
  attemptAggregate: vi.fn(),
  attemptExists: vi.fn(),
  folderAggregate: vi.fn(),
  folderCreate: vi.fn(),
  folderDeleteOne: vi.fn(),
  folderExists: vi.fn(),
  folderFindOne: vi.fn(),
  folderFindOneAndUpdate: vi.fn(),
  folderQuizAggregate: vi.fn(),
  folderQuizDeleteMany: vi.fn(),
  folderQuizDeleteOne: vi.fn(),
  folderQuizFind: vi.fn(),
  folderQuizUpdateOne: vi.fn(),
  quizCountDocuments: vi.fn(),
  quizFind: vi.fn(),
  quizFindById: vi.fn(),
  quizProgressAggregate: vi.fn(),
  quizProgressExists: vi.fn(),
  quizUpdateMany: vi.fn(),
  quizUpdateOne: vi.fn(),
  startSession: vi.fn(),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('mongoose', async () => {
  const actual = await vi.importActual<typeof import('mongoose')>('mongoose');
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: modelMocks.startSession,
    },
    startSession: modelMocks.startSession,
  };
});
vi.mock('@/models/Attempt', () => ({
  default: { aggregate: modelMocks.attemptAggregate, exists: modelMocks.attemptExists },
}));
vi.mock('@/models/Folder', () => ({
  default: {
    aggregate: modelMocks.folderAggregate,
    create: modelMocks.folderCreate,
    deleteOne: modelMocks.folderDeleteOne,
    exists: modelMocks.folderExists,
    findOne: modelMocks.folderFindOne,
    findOneAndUpdate: modelMocks.folderFindOneAndUpdate,
  },
}));
vi.mock('@/models/FolderQuiz', () => ({
  default: {
    aggregate: modelMocks.folderQuizAggregate,
    deleteMany: modelMocks.folderQuizDeleteMany,
    deleteOne: modelMocks.folderQuizDeleteOne,
    find: modelMocks.folderQuizFind,
    updateOne: modelMocks.folderQuizUpdateOne,
  },
}));
vi.mock('@/models/Quiz', () => ({
  default: {
    countDocuments: modelMocks.quizCountDocuments,
    find: modelMocks.quizFind,
    findById: modelMocks.quizFindById,
    updateMany: modelMocks.quizUpdateMany,
    updateOne: modelMocks.quizUpdateOne,
  },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: {
    aggregate: modelMocks.quizProgressAggregate,
    exists: modelMocks.quizProgressExists,
  },
}));

import { FolderRepository } from '@/repositories/FolderRepository';

const ownerId = '507f191e810c19729de860ea';
const folderId = '507f1f77bcf86cd799439011';
const quizId = '507f1f77bcf86cd799439012';

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

    await expect(repository.listOverviewByOwner(ownerId)).resolves.toEqual({
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

  it('adds linked folder-quiz counts and treats missing external count as zero', async () => {
    const folderObjectId = new Types.ObjectId(folderId);
    modelMocks.folderAggregate.mockResolvedValueOnce([
      {
        _id: folderObjectId,
        name: 'Algorithms',
        owner: new Types.ObjectId(ownerId),
        quizCount: 2,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    modelMocks.folderQuizAggregate.mockResolvedValueOnce([{ _id: folderObjectId, count: 3 }]);
    modelMocks.quizCountDocuments.mockResolvedValueOnce(4);
    modelMocks.attemptAggregate.mockResolvedValueOnce([]);

    const repository = new FolderRepository();
    await expect(repository.listOverviewByOwner(ownerId)).resolves.toEqual({
      folders: [
        expect.objectContaining({
          id: folderId,
          name: 'Algorithms',
          quizCount: 5,
        }),
      ],
      unfiledCount: 4,
    });
  });
});

describe('FolderRepository ownership guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create maps duplicate key errors to FolderNameConflictError', async () => {
    modelMocks.folderCreate.mockRejectedValueOnce(
      Object.assign(new Error('E11000 duplicate'), { code: 11000 }),
    );
    const repository = new FolderRepository();

    await expect(repository.create({ ownerId, name: 'Algorithms' })).rejects.toBeInstanceOf(
      FolderNameConflictError,
    );
  });

  it('create returns the mapped folder entity on success', async () => {
    const folderObjectId = new Types.ObjectId(folderId);
    const ownerObjectId = new Types.ObjectId(ownerId);
    modelMocks.folderCreate.mockResolvedValueOnce({
      _id: folderObjectId,
      name: 'Algorithms',
      owner: ownerObjectId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const repository = new FolderRepository();

    await expect(repository.create({ ownerId, name: 'Algorithms' })).resolves.toMatchObject({
      id: folderId,
      name: 'Algorithms',
      ownerId,
    });
    expect(modelMocks.folderCreate).toHaveBeenCalledWith({
      name: 'Algorithms',
      owner: ownerObjectId,
    });
  });

  it('findOwnedById returns null for invalid ids without querying Mongo', async () => {
    const repository = new FolderRepository();

    await expect(repository.findOwnedById('bad', ownerId)).resolves.toBeNull();
    await expect(repository.findOwnedById(folderId, 'bad')).resolves.toBeNull();
    expect(modelMocks.folderFindOne).not.toHaveBeenCalled();
  });

  it('findOwnedById maps an owned lean document and null for missing folders', async () => {
    const lean = vi.fn().mockResolvedValueOnce({
      _id: new Types.ObjectId(folderId),
      name: 'Algorithms',
      owner: new Types.ObjectId(ownerId),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    modelMocks.folderFindOne.mockReturnValueOnce({ lean });
    const repository = new FolderRepository();

    await expect(repository.findOwnedById(folderId, ownerId)).resolves.toMatchObject({
      id: folderId,
      name: 'Algorithms',
      ownerId,
    });
    expect(modelMocks.folderFindOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(folderId),
      owner: new Types.ObjectId(ownerId),
    });

    const missingLean = vi.fn().mockResolvedValueOnce(null);
    modelMocks.folderFindOne.mockReturnValueOnce({ lean: missingLean });
    await expect(repository.findOwnedById(folderId, ownerId)).resolves.toBeNull();
  });

  it('existsOwnedById rejects invalid ids and returns boolean ownership', async () => {
    const repository = new FolderRepository();

    await expect(repository.existsOwnedById('bad', ownerId)).resolves.toBe(false);
    expect(modelMocks.folderExists).not.toHaveBeenCalled();

    modelMocks.folderExists.mockResolvedValueOnce({ _id: folderId });
    await expect(repository.existsOwnedById(folderId, ownerId)).resolves.toBe(true);

    modelMocks.folderExists.mockResolvedValueOnce(null);
    await expect(repository.existsOwnedById(folderId, ownerId)).resolves.toBe(false);
  });

  it('rename maps duplicate key conflicts and missing owned folders', async () => {
    const lean = vi.fn().mockResolvedValueOnce(null);
    modelMocks.folderFindOneAndUpdate.mockReturnValueOnce({ lean });
    const repository = new FolderRepository();

    await expect(repository.rename(folderId, ownerId, 'New')).resolves.toBeNull();

    const conflictLean = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('E11000 duplicate'), { code: 11000 }));
    modelMocks.folderFindOneAndUpdate.mockReturnValueOnce({ lean: conflictLean });
    await expect(repository.rename(folderId, ownerId, 'Taken')).rejects.toBeInstanceOf(
      FolderNameConflictError,
    );
  });
});

describe('FolderRepository.saveQuizPlacement ownership paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.quizUpdateOne.mockResolvedValue({ acknowledged: true });
    modelMocks.folderQuizDeleteOne.mockResolvedValue({ acknowledged: true });
    modelMocks.folderQuizUpdateOne.mockResolvedValue({ acknowledged: true });
  });

  it('moves owned quizzes by updating Quiz.folder and clearing FolderQuiz links', async () => {
    const repository = new FolderRepository();

    await repository.saveQuizPlacement(ownerId, quizId, ownerId, folderId);

    expect(modelMocks.quizUpdateOne).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(quizId), author: new Types.ObjectId(ownerId) },
      { $set: { folder: new Types.ObjectId(folderId) } },
    );
    expect(modelMocks.folderQuizDeleteOne).toHaveBeenCalledWith({
      owner: new Types.ObjectId(ownerId),
      quiz: new Types.ObjectId(quizId),
    });
    expect(modelMocks.folderQuizUpdateOne).not.toHaveBeenCalled();
  });

  it('unfiles non-owned quizzes by deleting FolderQuiz links only', async () => {
    const repository = new FolderRepository();

    await repository.saveQuizPlacement(ownerId, quizId, '507f1f77bcf86cd799439099', null);

    expect(modelMocks.folderQuizDeleteOne).toHaveBeenCalledWith({
      owner: new Types.ObjectId(ownerId),
      quiz: new Types.ObjectId(quizId),
    });
    expect(modelMocks.quizUpdateOne).not.toHaveBeenCalled();
    expect(modelMocks.folderQuizUpdateOne).not.toHaveBeenCalled();
  });

  it('upserts FolderQuiz links for non-owned quizzes into a folder', async () => {
    const repository = new FolderRepository();

    await repository.saveQuizPlacement(ownerId, quizId, '507f1f77bcf86cd799439099', folderId);

    expect(modelMocks.folderQuizUpdateOne).toHaveBeenCalledWith(
      { owner: new Types.ObjectId(ownerId), quiz: new Types.ObjectId(quizId) },
      { $set: { folder: new Types.ObjectId(folderId) } },
      { upsert: true },
    );
    expect(modelMocks.quizUpdateOne).not.toHaveBeenCalled();
  });
});

describe('FolderRepository.deleteOwned cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) =>
      callback(),
    );
    modelMocks.startSession.mockResolvedValue({
      withTransaction: modelMocks.withTransaction,
      endSession: modelMocks.endSession,
    });
    modelMocks.quizUpdateMany.mockReturnValue({
      session: vi.fn().mockResolvedValue({ acknowledged: true }),
    });
    modelMocks.folderQuizDeleteMany.mockReturnValue({
      session: vi.fn().mockResolvedValue({ acknowledged: true }),
    });
    modelMocks.folderDeleteOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });
  });

  it('unfiles owned quizzes, drops FolderQuiz links, and deletes the folder in one transaction', async () => {
    const folderObjectId = new Types.ObjectId(folderId);
    const ownerObjectId = new Types.ObjectId(ownerId);
    modelMocks.folderFindOne.mockReturnValueOnce({
      select: vi.fn(() => ({
        session: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue({ _id: folderObjectId }),
        })),
      })),
    });
    const repository = new FolderRepository();

    await expect(repository.deleteOwned(folderId, ownerId)).resolves.toBe(true);

    const session = await modelMocks.startSession.mock.results[0]?.value;
    expect(modelMocks.quizUpdateMany).toHaveBeenCalledWith(
      { author: ownerObjectId, folder: folderObjectId },
      { $set: { folder: null } },
    );
    expect(modelMocks.folderQuizDeleteMany).toHaveBeenCalledWith({
      owner: ownerObjectId,
      folder: folderObjectId,
    });
    expect(modelMocks.folderDeleteOne).toHaveBeenCalledWith({
      _id: folderObjectId,
      owner: ownerObjectId,
    });
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('returns false without mutating when the owned folder is missing', async () => {
    modelMocks.folderFindOne.mockReturnValueOnce({
      select: vi.fn(() => ({
        session: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue(null),
        })),
      })),
    });
    const repository = new FolderRepository();

    await expect(repository.deleteOwned(folderId, ownerId)).resolves.toBe(false);
    expect(modelMocks.quizUpdateMany).not.toHaveBeenCalled();
    expect(modelMocks.folderQuizDeleteMany).not.toHaveBeenCalled();
    expect(modelMocks.folderDeleteOne).not.toHaveBeenCalled();
    expect(modelMocks.endSession).toHaveBeenCalledOnce();
  });
});

describe('FolderRepository.findQuizAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the quiz does not exist', async () => {
    modelMocks.quizFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });
    modelMocks.attemptExists.mockResolvedValueOnce(null);
    modelMocks.quizProgressExists.mockResolvedValueOnce(null);
    const repository = new FolderRepository();

    await expect(repository.findQuizAccess(ownerId, quizId)).resolves.toBeNull();
  });

  it('maps ownership and attempt/progress flags for an existing quiz', async () => {
    modelMocks.quizFindById.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(quizId),
          author: new Types.ObjectId(ownerId),
        }),
      }),
    });
    modelMocks.attemptExists.mockResolvedValueOnce({ _id: 'attempt' });
    modelMocks.quizProgressExists.mockResolvedValueOnce(null);
    const repository = new FolderRepository();

    await expect(repository.findQuizAccess(ownerId, quizId)).resolves.toEqual({
      quizId,
      quizOwnerId: ownerId,
      hasAttempt: true,
      hasProgress: false,
    });
  });
});
