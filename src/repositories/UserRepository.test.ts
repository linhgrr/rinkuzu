import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const userModelMocks = vi.hoisted(() => {
  const findByIdLean = vi.fn();
  const findByIdSessionLean = vi.fn();
  const findByIdSession = vi.fn(() => ({ lean: findByIdSessionLean }));
  const findByIdSelect = vi.fn(() => ({ lean: findByIdLean, session: findByIdSession }));
  const findById = vi.fn(() => ({ select: findByIdSelect }));

  const findOneLean = vi.fn();
  const findOneSelect = vi.fn(() => ({ lean: findOneLean }));
  const findOne = vi.fn(() => ({ select: findOneSelect }));

  const listLean = vi.fn();
  const limit = vi.fn(() => ({ lean: listLean }));
  const skip = vi.fn(() => ({ limit }));
  const sort = vi.fn(() => ({ skip, limit }));
  const listSelect = vi.fn(() => ({ sort }));
  const find = vi.fn(() => ({ select: listSelect }));

  const updateLean = vi.fn();
  const updateSelect = vi.fn(() => ({ lean: updateLean }));
  const findByIdAndUpdate = vi.fn(() => ({ select: updateSelect }));

  return {
    aggregate: vi.fn(),
    countDocuments: vi.fn(),
    deleteOne: vi.fn(),
    find,
    findById,
    findByIdAndUpdate,
    findByIdLean,
    findByIdSelect,
    findByIdSession,
    findByIdSessionLean,
    findOne,
    findOneLean,
    findOneSelect,
    listLean,
    limit,
    skip,
    sort,
    listSelect,
    updateLean,
    updateSelect,
  };
});

const cascadeMocks = vi.hoisted(() => ({
  attemptDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  subscriptionDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  subscriptionUpdateMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  bookmarkDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  questionProgressDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  userProgressDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  quizProgressDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  folderQuizDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  folderDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  discussionUpdateMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  reportDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  quizFind: vi.fn(),
  quizDeleteMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  auditLogUpdateMany: vi.fn(() => ({ session: vi.fn().mockResolvedValue(undefined) })),
  deleteQuizDependents: vi.fn().mockResolvedValue(undefined),
  deleteOwnedPdfUrlsBestEffort: vi.fn().mockResolvedValue(undefined),
  withTransaction: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/User', () => ({
  default: {
    aggregate: userModelMocks.aggregate,
    countDocuments: userModelMocks.countDocuments,
    deleteOne: userModelMocks.deleteOne,
    find: userModelMocks.find,
    findById: userModelMocks.findById,
    findByIdAndUpdate: userModelMocks.findByIdAndUpdate,
    findOne: userModelMocks.findOne,
  },
}));

vi.mock('@/models/Attempt', () => ({
  default: { deleteMany: cascadeMocks.attemptDeleteMany },
}));
vi.mock('@/models/Subscription', () => ({
  default: {
    deleteMany: cascadeMocks.subscriptionDeleteMany,
    updateMany: cascadeMocks.subscriptionUpdateMany,
  },
}));
vi.mock('@/models/Bookmark', () => ({
  default: { deleteMany: cascadeMocks.bookmarkDeleteMany },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { deleteMany: cascadeMocks.questionProgressDeleteMany },
}));
vi.mock('@/models/UserProgress', () => ({
  default: { deleteMany: cascadeMocks.userProgressDeleteMany },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { deleteMany: cascadeMocks.quizProgressDeleteMany },
}));
vi.mock('@/models/FolderQuiz', () => ({
  default: { deleteMany: cascadeMocks.folderQuizDeleteMany },
}));
vi.mock('@/models/Folder', () => ({
  default: { deleteMany: cascadeMocks.folderDeleteMany },
}));
vi.mock('@/models/Discussion', () => ({
  default: { updateMany: cascadeMocks.discussionUpdateMany },
}));
vi.mock('@/models/Report', () => ({
  default: { deleteMany: cascadeMocks.reportDeleteMany },
}));
vi.mock('@/models/Quiz', () => ({
  default: {
    find: cascadeMocks.quizFind,
    deleteMany: cascadeMocks.quizDeleteMany,
  },
}));
vi.mock('@/models/AuditLog', () => ({
  default: { updateMany: cascadeMocks.auditLogUpdateMany },
}));
vi.mock('@/repositories/helpers/deleteQuizDependents', () => ({
  deleteQuizDependents: cascadeMocks.deleteQuizDependents,
}));
vi.mock('@/lib/s3', () => ({
  deleteOwnedPdfUrlsBestEffort: cascadeMocks.deleteOwnedPdfUrlsBestEffort,
}));
vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mongoose')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: cascadeMocks.startSession,
    },
  };
});

import { UserRepository } from '@/repositories/UserRepository';

const USER_ENTITY_PROJECTION = '_id email name displayName bio avatar role subscription createdAt';
const userRecord = {
  _id: new Types.ObjectId('507f191e810c19729de860ea'),
  email: 'learner@example.com',
  displayName: 'Learner',
  role: 'user' as const,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('UserRepository entity projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userModelMocks.findByIdLean.mockResolvedValue(userRecord);
    userModelMocks.findOneLean.mockResolvedValue(userRecord);
    userModelMocks.listLean.mockResolvedValue([userRecord]);
    userModelMocks.updateLean.mockResolvedValue({ ...userRecord, role: 'admin' });
    userModelMocks.countDocuments.mockResolvedValue(1);
  });

  it('allowlists entity fields for single-user reads', async () => {
    const repository = new UserRepository();

    await expect(repository.findById(String(userRecord._id))).resolves.toMatchObject({
      email: userRecord.email,
    });
    await expect(repository.findByEmail(userRecord.email)).resolves.toMatchObject({
      email: userRecord.email,
    });

    expect(userModelMocks.findByIdSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.findOne).toHaveBeenCalledWith({ email: userRecord.email });
    expect(userModelMocks.findOneSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
  });

  it('returns null when findById or findByEmail misses', async () => {
    userModelMocks.findByIdLean.mockResolvedValueOnce(null);
    userModelMocks.findOneLean.mockResolvedValueOnce(null);
    const repository = new UserRepository();

    await expect(repository.findById(String(userRecord._id))).resolves.toBeNull();
    await expect(repository.findByEmail(userRecord.email)).resolves.toBeNull();
  });

  it('allowlists entity fields for admin lists and role updates', async () => {
    const repository = new UserRepository();

    await expect(repository.findAll({ page: 1, limit: 20 })).resolves.toMatchObject({
      items: [{ email: userRecord.email }],
      pagination: { totalItems: 1 },
    });
    await expect(repository.updateRole(String(userRecord._id), 'admin')).resolves.toMatchObject({
      role: 'admin',
    });

    expect(userModelMocks.listSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.updateSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      String(userRecord._id),
      { $set: { role: 'admin' } },
      { new: true },
    );
    expect(USER_ENTITY_PROJECTION).not.toMatch(/password|token|failedLogin|lockedUntil|lastLogin/i);
  });

  it('returns null from updateRole when the user is missing', async () => {
    userModelMocks.updateLean.mockResolvedValueOnce(null);
    await expect(
      new UserRepository().updateRole(String(userRecord._id), 'admin'),
    ).resolves.toBeNull();
  });

  it('loads recent users without a count query and sorts newest first', async () => {
    const repository = new UserRepository();

    await expect(repository.findRecent(5)).resolves.toMatchObject([{ email: userRecord.email }]);

    expect(userModelMocks.find).toHaveBeenCalledWith({});
    expect(userModelMocks.listSelect).toHaveBeenCalledWith(USER_ENTITY_PROJECTION);
    expect(userModelMocks.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(userModelMocks.limit).toHaveBeenCalledWith(5);
    expect(userModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('applies search and role filters with page offsets for admin lists', async () => {
    const repository = new UserRepository();

    await repository.findAll({ page: 2, limit: 10, search: 'learner', role: 'admin' });

    expect(userModelMocks.find).toHaveBeenCalledWith({
      email: { $regex: 'learner', $options: 'i' },
      role: 'admin',
    });
    expect(userModelMocks.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(userModelMocks.skip).toHaveBeenCalledWith(10);
    expect(userModelMocks.limit).toHaveBeenCalledWith(10);
  });

  it('omits search and role clauses when those filters are absent', async () => {
    await new UserRepository().findAll({ page: 1, limit: 5 });
    expect(userModelMocks.find).toHaveBeenCalledWith({});
    expect(userModelMocks.skip).toHaveBeenCalledWith(0);
  });

  it('maps subscription snapshots and public profiles while omitting missing data', async () => {
    userModelMocks.findByIdLean
      .mockResolvedValueOnce({
        subscription: {
          type: 'premium',
          isActive: true,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({ subscription: undefined })
      .mockResolvedValueOnce({ subscription: null })
      .mockResolvedValueOnce({
        _id: userRecord._id,
        email: userRecord.email,
        displayName: 'Learner',
        bio: 'Hello',
        avatar: 'https://example.com/a.png',
        createdAt: userRecord.createdAt,
      })
      .mockResolvedValueOnce(null);

    const repository = new UserRepository();
    await expect(repository.findSubscriptionById(String(userRecord._id))).resolves.toMatchObject({
      type: 'premium',
      isActive: true,
    });
    expect(userModelMocks.findByIdSelect).toHaveBeenCalledWith('subscription');
    await expect(repository.findSubscriptionById(String(userRecord._id))).resolves.toBeNull();
    await expect(repository.findSubscriptionById(String(userRecord._id))).resolves.toBeNull();
    await expect(repository.findPublicProfileById(String(userRecord._id))).resolves.toMatchObject({
      displayName: 'Learner',
      bio: 'Hello',
    });
    expect(userModelMocks.findByIdSelect).toHaveBeenCalledWith(
      'email name displayName bio avatar createdAt',
    );
    await expect(repository.findPublicProfileById(String(userRecord._id))).resolves.toBeNull();
  });

  it('aggregates role counts with a group/project pipeline', async () => {
    userModelMocks.aggregate.mockResolvedValueOnce([
      { role: 'user', count: 3 },
      { role: 'admin', count: 1 },
    ]);

    await expect(new UserRepository().countByRole()).resolves.toEqual([
      { role: 'user', count: 3 },
      { role: 'admin', count: 1 },
    ]);
    expect(userModelMocks.aggregate).toHaveBeenCalledWith([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          role: '$_id',
          count: 1,
        },
      },
    ]);
  });

  it('counts created-at buckets and generic filters', async () => {
    userModelMocks.aggregate.mockResolvedValueOnce([
      { _id: null, today: 2, thisWeek: 5, thisMonth: 9 },
    ]);
    userModelMocks.countDocuments.mockResolvedValueOnce(42);

    const thresholds = {
      today: new Date('2026-07-16T00:00:00.000Z'),
      thisWeek: new Date('2026-07-10T00:00:00.000Z'),
      thisMonth: new Date('2026-06-16T00:00:00.000Z'),
    };
    await expect(new UserRepository().countByCreatedAtBuckets(thresholds)).resolves.toEqual({
      today: 2,
      thisWeek: 5,
      thisMonth: 9,
    });
    const pipeline = userModelMocks.aggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(pipeline).toEqual([
      {
        $match: {
          createdAt: { $gte: thresholds.thisMonth },
        },
      },
      {
        $group: {
          _id: null,
          today: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', thresholds.today] }, 1, 0],
            },
          },
          thisWeek: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', thresholds.thisWeek] }, 1, 0],
            },
          },
          thisMonth: { $sum: 1 },
        },
      },
    ]);

    await expect(
      new UserRepository().count({ createdAt: { $gte: thresholds.today } }),
    ).resolves.toBe(42);
    expect(userModelMocks.countDocuments).toHaveBeenCalledWith({
      createdAt: { $gte: thresholds.today },
    });
    await expect(new UserRepository().count()).resolves.toBe(1);
    expect(userModelMocks.countDocuments).toHaveBeenLastCalledWith({});
  });
});

describe('UserRepository.delete cascade', () => {
  const userId = String(userRecord._id);
  const authoredQuizId = new Types.ObjectId('507f191e810c19729de860eb');

  beforeEach(() => {
    vi.clearAllMocks();
    cascadeMocks.withTransaction.mockImplementation(async (callback: () => Promise<void>) =>
      callback(),
    );
    cascadeMocks.startSession.mockResolvedValue({
      withTransaction: cascadeMocks.withTransaction,
      endSession: cascadeMocks.endSession,
    });
    userModelMocks.findByIdSessionLean.mockResolvedValue({
      _id: userRecord._id,
      email: 'Learner@Example.com',
    });
    cascadeMocks.quizFind.mockReturnValue({
      select: vi.fn(() => ({
        session: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue([
            {
              _id: authoredQuizId,
              slug: 'authored-quiz',
              pdfUrl: 'https://cdn.example.com/test-bucket/uploads/quiz_extract/authored.pdf',
            },
          ]),
        })),
      })),
    });
    userModelMocks.deleteOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });
  });

  it('rejects invalid object ids without opening a session', async () => {
    await expect(new UserRepository().delete('not-valid')).resolves.toBe(false);
    expect(cascadeMocks.startSession).not.toHaveBeenCalled();
  });

  it('returns false and ends the session when the user document is missing', async () => {
    userModelMocks.findByIdSessionLean.mockResolvedValueOnce(null);

    await expect(new UserRepository().delete(userId)).resolves.toBe(false);
    expect(cascadeMocks.attemptDeleteMany).not.toHaveBeenCalled();
    expect(cascadeMocks.deleteOwnedPdfUrlsBestEffort).not.toHaveBeenCalled();
    expect(cascadeMocks.endSession).toHaveBeenCalledOnce();
  });

  it('cascades ownership cleanup, lowercases email matches, and deletes authored quizzes', async () => {
    await expect(new UserRepository().delete(userId)).resolves.toBe(true);

    const session = await cascadeMocks.startSession.mock.results[0]?.value;
    const attemptSession = cascadeMocks.attemptDeleteMany.mock.results[0]?.value
      .session as ReturnType<typeof vi.fn>;

    expect(cascadeMocks.attemptDeleteMany).toHaveBeenCalledWith({
      $or: [{ user: expect.any(Types.ObjectId) }, { guestEmail: 'learner@example.com' }],
    });
    expect(attemptSession).toHaveBeenCalledWith(session);
    // Pending/incomplete billing rows are hard-deleted; financially relevant history is retained.
    expect(cascadeMocks.subscriptionDeleteMany).toHaveBeenCalledWith({
      $or: [{ user: expect.any(Types.ObjectId) }, { userEmail: 'learner@example.com' }],
      status: 'pending',
    });
    expect(cascadeMocks.subscriptionUpdateMany).toHaveBeenCalledWith(
      {
        $or: [{ user: expect.any(Types.ObjectId) }, { userEmail: 'learner@example.com' }],
        status: { $in: ['completed', 'failed', 'cancelled', 'expired'] },
      },
      {
        $set: {
          userEmail: `deleted+${userId}@retained.local`,
          isActive: false,
        },
        $unset: { payosPaymentUrl: 1 },
      },
    );
    expect(cascadeMocks.bookmarkDeleteMany).toHaveBeenCalledWith({
      $or: [{ userId }, { userEmail: 'learner@example.com' }],
    });
    expect(cascadeMocks.questionProgressDeleteMany).toHaveBeenCalledWith({ userId });
    expect(cascadeMocks.userProgressDeleteMany).toHaveBeenCalledWith({ userId });
    expect(cascadeMocks.quizProgressDeleteMany).toHaveBeenCalledWith({
      userId: expect.any(Types.ObjectId),
    });
    expect(cascadeMocks.folderQuizDeleteMany).toHaveBeenCalledWith({
      owner: expect.any(Types.ObjectId),
    });
    expect(cascadeMocks.folderDeleteMany).toHaveBeenCalledWith({
      owner: expect.any(Types.ObjectId),
    });
    expect(cascadeMocks.discussionUpdateMany).toHaveBeenCalledWith(
      { 'comments.author': expect.any(Types.ObjectId) },
      { $pull: { comments: { author: expect.any(Types.ObjectId) } } },
    );
    expect(cascadeMocks.reportDeleteMany).toHaveBeenCalledWith({
      reporterEmail: 'learner@example.com',
    });
    expect(cascadeMocks.deleteQuizDependents).toHaveBeenCalledWith(
      [{ id: authoredQuizId, slug: 'authored-quiz' }],
      expect.any(Object),
    );
    expect(cascadeMocks.quizDeleteMany).toHaveBeenCalledWith({
      _id: { $in: [authoredQuizId] },
    });
    expect(cascadeMocks.auditLogUpdateMany).toHaveBeenCalledWith(
      { userId: expect.any(Types.ObjectId) },
      { $set: { userId: null } },
    );
    expect(userModelMocks.deleteOne).toHaveBeenCalledWith({ _id: expect.any(Types.ObjectId) });
    expect(cascadeMocks.deleteOwnedPdfUrlsBestEffort).toHaveBeenCalledWith([
      'https://cdn.example.com/test-bucket/uploads/quiz_extract/authored.pdf',
    ]);
    expect(cascadeMocks.endSession).toHaveBeenCalledOnce();
  });

  it('retains scrubbed completed billing history and only hard-deletes pending rows', async () => {
    await expect(new UserRepository().delete(userId)).resolves.toBe(true);

    expect(cascadeMocks.subscriptionDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
    expect(cascadeMocks.subscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['completed', 'failed', 'cancelled', 'expired'] },
      }),
      {
        $set: {
          userEmail: `deleted+${userId}@retained.local`,
          isActive: false,
        },
        $unset: { payosPaymentUrl: 1 },
      },
    );
    // Audit logs are nullified, never deleted.
    expect(cascadeMocks.auditLogUpdateMany).toHaveBeenCalled();
  });

  it('is idempotent when the user is already gone (repeated deletion)', async () => {
    userModelMocks.findByIdSessionLean.mockResolvedValueOnce(null);

    await expect(new UserRepository().delete(userId)).resolves.toBe(false);
    expect(cascadeMocks.subscriptionDeleteMany).not.toHaveBeenCalled();
    expect(cascadeMocks.subscriptionUpdateMany).not.toHaveBeenCalled();
    expect(userModelMocks.deleteOne).not.toHaveBeenCalled();
    expect(cascadeMocks.endSession).toHaveBeenCalledOnce();
  });

  it('skips quiz deletion when the user authored no quizzes and reports false on partial delete', async () => {
    cascadeMocks.quizFind.mockReturnValueOnce({
      select: vi.fn(() => ({
        session: vi.fn(() => ({
          lean: vi.fn().mockResolvedValue([]),
        })),
      })),
    });
    userModelMocks.deleteOne.mockReturnValueOnce({
      session: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    });

    await expect(new UserRepository().delete(userId)).resolves.toBe(false);
    expect(cascadeMocks.quizDeleteMany).not.toHaveBeenCalled();
    expect(cascadeMocks.deleteQuizDependents).toHaveBeenCalledWith([], expect.any(Object));
    expect(cascadeMocks.deleteOwnedPdfUrlsBestEffort).not.toHaveBeenCalled();
  });
});
