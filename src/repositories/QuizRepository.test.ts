import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const quizModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOne: vi.fn(),
  populate: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
  updateLean: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Quiz', () => ({
  default: {
    aggregate: quizModelMocks.aggregate,
    countDocuments: quizModelMocks.countDocuments,
    findById: quizModelMocks.findById,
    findByIdAndUpdate: quizModelMocks.findByIdAndUpdate,
    findOne: quizModelMocks.findOne,
  },
}));

import { QuizRepository } from '@/repositories/QuizRepository';

describe('QuizRepository.findUserQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizModelMocks.findById.mockReturnValue({ select: quizModelMocks.select });
    quizModelMocks.findByIdAndUpdate.mockReturnValue({ populate: quizModelMocks.populate });
    quizModelMocks.findOne.mockReturnValue({ select: quizModelMocks.select });
    quizModelMocks.populate.mockReturnValue({ lean: quizModelMocks.updateLean });
    quizModelMocks.select.mockReturnValue({ lean: quizModelMocks.lean });
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
    quizModelMocks.updateLean.mockResolvedValue(null);
  });

  it('projects only fields required for quiz access checks', async () => {
    quizModelMocks.lean.mockResolvedValue({
      _id: new Types.ObjectId('507f191e810c19729de860ea'),
      author: '507f191e810c19729de860eb',
      isPrivate: true,
    });
    const repository = new QuizRepository();

    await expect(repository.findAccessById('507f191e810c19729de860ea')).resolves.toEqual({
      id: '507f191e810c19729de860ea',
      author: '507f191e810c19729de860eb',
      isPrivate: true,
    });
    expect(quizModelMocks.findById).toHaveBeenCalledWith('507f191e810c19729de860ea');
    expect(quizModelMocks.select).toHaveBeenCalledWith('_id author isPrivate');
    expect(quizModelMocks.lean).toHaveBeenCalledOnce();
  });

  it('runs persistence validators when updating a quiz', async () => {
    const repository = new QuizRepository();

    await expect(repository.update('507f191e810c19729de860ea', { title: 'Updated' })).resolves.toBe(
      null,
    );

    expect(quizModelMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f191e810c19729de860ea',
      { title: 'Updated' },
      { new: true, runValidators: true },
    );
  });

  it('projects only fields needed to play or submit a quiz', async () => {
    quizModelMocks.lean.mockResolvedValue({
      _id: new Types.ObjectId('507f191e810c19729de860ea'),
      title: 'Algebra Basics',
      description: 'Linear equations',
      slug: 'algebra-basics',
      author: '507f191e810c19729de860eb',
      folder: null,
      questions: [],
      isPrivate: false,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T01:00:00.000Z'),
    });
    const repository = new QuizRepository();

    await expect(repository.findForPlay('algebra-basics')).resolves.toMatchObject({
      id: '507f191e810c19729de860ea',
      author: '507f191e810c19729de860eb',
      questions: [],
    });
    expect(quizModelMocks.findOne).toHaveBeenCalledWith({ slug: 'algebra-basics' });
    expect(quizModelMocks.select).toHaveBeenCalledWith(
      '_id title description slug author folder questions isPrivate pdfUrl tags sourceDraftId createdAt updatedAt',
    );
    expect(quizModelMocks.lean).toHaveBeenCalledOnce();
  });

  it('loads quiz details by slug and author in one aggregation', async () => {
    const quizId = new Types.ObjectId('507f191e810c19729de860ea');
    const authorId = new Types.ObjectId('507f191e810c19729de860eb');
    quizModelMocks.aggregate.mockResolvedValueOnce([
      {
        _id: quizId,
        title: 'Algebra Basics',
        description: 'Linear equations',
        slug: 'algebra-basics',
        author: {
          _id: authorId,
          email: 'learner@example.com',
          displayName: 'Learner',
        },
        folder: null,
        questions: [],
        isPrivate: false,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T01:00:00.000Z'),
      },
    ]);
    const repository = new QuizRepository();

    await expect(repository.findBySlug('algebra-basics')).resolves.toMatchObject({
      id: String(quizId),
      author: {
        id: String(authorId),
        email: 'learner@example.com',
        displayName: 'Learner',
      },
      questions: [],
    });
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
      { $match: { slug: 'algebra-basics' } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDoc',
        },
      },
      {
        $project: expect.objectContaining({
          author: expect.objectContaining({
            _id: { $ifNull: [{ $first: '$authorDoc._id' }, '$author'] },
            email: { $first: '$authorDoc.email' },
          }),
          questions: 1,
        }),
      },
    ]);
    expect(quizModelMocks.findOne).not.toHaveBeenCalled();
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

  it('paginates public profile quizzes and counts the full result set', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    const result = await repository.findPublicByAuthor(userId, { page: 2, limit: 12 });

    expect(result.pagination).toMatchObject({
      currentPage: 2,
      totalItems: 1,
      itemsPerPage: 12,
    });
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          author: new Types.ObjectId(userId),
          isPrivate: false,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: 12 },
      { $limit: 12 },
      {
        $project: expect.objectContaining({
          questions: { $literal: [] },
          questionCount: { $size: { $ifNull: ['$questions', []] } },
        }),
      },
    ]);
    expect(quizModelMocks.countDocuments).toHaveBeenCalledWith({
      author: new Types.ObjectId(userId),
      isPrivate: false,
    });
  });

  it('normalizes excludeAuthor for compact public quiz queries', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    await repository.findAll(
      { isPrivate: false, excludeAuthor: userId },
      { page: 1, limit: 4, compact: true, sort: { createdAt: -1 } },
    );

    const expectedFilter = {
      isPrivate: false,
      author: { $ne: new Types.ObjectId(userId) },
    };
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
      { $match: expectedFilter },
      { $sort: { createdAt: -1 } },
      { $skip: 0 },
      { $limit: 4 },
      expect.objectContaining({ $lookup: expect.any(Object) }),
      expect.objectContaining({ $unwind: expect.any(Object) }),
      expect.objectContaining({ $project: expect.any(Object) }),
    ]);
    expect(quizModelMocks.countDocuments).toHaveBeenCalledWith(expectedFilter);
  });

  it('loads recent quizzes without a count query', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    await repository.findRecent({ author: userId }, { limit: 4, sort: { createdAt: -1 } });

    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0];
    expect(pipeline).toEqual([
      { $match: { author: new Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      { $skip: 0 },
      { $limit: 4 },
      expect.objectContaining({
        $project: expect.objectContaining({ author: 1, questions: { $literal: [] } }),
      }),
    ]);
    expect(pipeline).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ $lookup: expect.any(Object) })]),
    );
    expect(quizModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('loads recent public quizzes with the requested author snapshot and no count query', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    await repository.findRecent(
      { isPrivate: false, excludeAuthor: userId },
      { limit: 4, populate: ['author'] },
    );

    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0];
    expect(pipeline).toEqual([
      {
        $match: {
          isPrivate: false,
          author: { $ne: new Types.ObjectId(userId) },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: 0 },
      { $limit: 4 },
      expect.objectContaining({ $lookup: expect.any(Object) }),
      expect.objectContaining({ $unwind: expect.any(Object) }),
      expect.objectContaining({
        $project: expect.objectContaining({ author: expect.any(Object) }),
      }),
    ]);
    expect(quizModelMocks.countDocuments).not.toHaveBeenCalled();
  });
});
