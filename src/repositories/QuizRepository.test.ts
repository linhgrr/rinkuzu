import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const quizModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  find: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
  populate: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
  updateLean: vi.fn(),
}));

const quizListRecord = {
  _id: new Types.ObjectId('507f191e810c19729de860ea'),
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: new Types.ObjectId('507f191e810c19729de860eb'),
  folder: null,
  questions: [],
  questionCount: 12,
  visibility: 'public',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Quiz', () => ({
  default: {
    aggregate: quizModelMocks.aggregate,
    countDocuments: quizModelMocks.countDocuments,
    find: quizModelMocks.find,
    findById: quizModelMocks.findById,
    findByIdAndUpdate: quizModelMocks.findByIdAndUpdate,
    findOne: quizModelMocks.findOne,
    updateOne: quizModelMocks.updateOne,
  },
}));

const userModelMocks = vi.hoisted(() => ({ find: vi.fn() }));

vi.mock('@/models/User', () => ({ default: { find: userModelMocks.find } }));

import { QuizRepository } from '@/repositories/QuizRepository';
import { PUBLIC_CATALOG_OWNER_EMAILS } from '@/shared/constants/analytics-exclusions';

describe('QuizRepository.findUserQuizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizModelMocks.findById.mockReturnValue({ select: quizModelMocks.select });
    quizModelMocks.findByIdAndUpdate.mockReturnValue({ populate: quizModelMocks.populate });
    quizModelMocks.findOne.mockReturnValue({ select: quizModelMocks.select });
    quizModelMocks.populate.mockReturnValue({ lean: quizModelMocks.updateLean });
    quizModelMocks.select.mockReturnValue({ lean: quizModelMocks.lean });
    quizModelMocks.aggregate.mockResolvedValue([quizListRecord]);
    quizModelMocks.countDocuments.mockResolvedValue(1);
    quizModelMocks.updateLean.mockResolvedValue(null);
    quizModelMocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it('projects only fields required for quiz access checks', async () => {
    quizModelMocks.lean.mockResolvedValue({
      _id: new Types.ObjectId('507f191e810c19729de860ea'),
      author: '507f191e810c19729de860eb',
      visibility: 'personal',
    });
    const repository = new QuizRepository();

    await expect(repository.findAccessById('507f191e810c19729de860ea')).resolves.toEqual({
      id: '507f191e810c19729de860ea',
      author: '507f191e810c19729de860eb',
      visibility: 'personal',
    });
    expect(quizModelMocks.findById).toHaveBeenCalledWith('507f191e810c19729de860ea');
    expect(quizModelMocks.select).toHaveBeenCalledWith('_id author visibility');
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

  it('atomically updates only the reported question and preserves its id', async () => {
    const repository = new QuizRepository();
    const quizId = '507f191e810c19729de860ea';
    const questionId = '507f191e810c19729de860ec';

    await expect(
      repository.updateQuestionById(quizId, questionId, {
        question: 'Updated question',
        options: ['A', 'B'],
        type: 'single',
        correctIndex: 1,
      }),
    ).resolves.toBe(true);

    expect(quizModelMocks.updateOne).toHaveBeenCalledWith(
      { _id: quizId, 'questions._id': questionId },
      {
        $set: {
          'questions.$.question': 'Updated question',
          'questions.$.options': ['A', 'B'],
          'questions.$.type': 'single',
          'questions.$.correctIndex': 1,
        },
        $unset: {
          'questions.$.correctIndexes': 1,
          'questions.$.questionImage': 1,
          'questions.$.optionImages': 1,
        },
      },
      { runValidators: true },
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
      visibility: 'public',
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
      '_id title description slug author questions visibility pdfUrl tags sourceDraftId createdAt updatedAt',
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
          displayName: 'Learner',
        },
        folder: null,
        questions: [],
        visibility: 'public',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T01:00:00.000Z'),
      },
    ]);
    const repository = new QuizRepository();

    await expect(repository.findBySlug('algebra-basics')).resolves.toMatchObject({
      id: String(quizId),
      author: {
        id: String(authorId),
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
            displayName: { $first: '$authorDoc.displayName' },
          }),
          questions: 1,
        }),
      },
    ]);
    const projectCall = quizModelMocks.aggregate.mock.calls[0]?.[0]?.find(
      (stage: { $project?: unknown }) => stage.$project,
    );
    expect(JSON.stringify(projectCall?.$project?.author ?? {})).not.toMatch(/email/);
    expect(quizModelMocks.findOne).not.toHaveBeenCalled();
  });

  it('projects user quiz list rows without loading question payloads', async () => {
    quizModelMocks.aggregate.mockResolvedValueOnce([
      { items: [quizListRecord], meta: [{ totalItems: 1 }] },
    ]);
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
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ $lookup: expect.objectContaining({ from: 'folderquizzes' }) }),
        { $match: { author: new Types.ObjectId(userId) } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            items: [
              { $skip: 10 },
              { $limit: 10 },
              {
                $project: expect.objectContaining({
                  questions: { $literal: [] },
                  questionCount: { $size: { $ifNull: ['$questions', []] } },
                }),
              },
            ],
            meta: [{ $count: 'totalItems' }],
          },
        },
      ]),
    );
    expect(quizModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('paginates public profile quizzes and counts the full result set', async () => {
    quizModelMocks.aggregate.mockResolvedValueOnce([
      { items: [quizListRecord], meta: [{ totalItems: 1 }] },
    ]);
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
          visibility: 'public',
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: 12 },
            { $limit: 12 },
            {
              $project: expect.objectContaining({
                questions: { $literal: [] },
                questionCount: { $size: { $ifNull: ['$questions', []] } },
              }),
            },
          ],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ]);
    expect(quizModelMocks.countDocuments).not.toHaveBeenCalled();
  });

  it('normalizes excludeAuthor for indexed public quiz page and count queries', async () => {
    const repository = new QuizRepository();
    const userId = '507f191e810c19729de860eb';

    await repository.findAll(
      { visibility: 'public', excludeAuthor: userId },
      { page: 1, limit: 4, sort: { createdAt: -1 } },
    );

    const expectedFilter = {
      visibility: 'public',
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

  it('uses the _id index for an exact unfiltered quiz count', async () => {
    const repository = new QuizRepository();

    await repository.findAll({}, { page: 1, limit: 12, sort: { createdAt: -1 } });

    expect(quizModelMocks.countDocuments).toHaveBeenCalledWith({}, { hint: '_id_' });
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
      { visibility: 'public', excludeAuthor: userId },
      { limit: 4, populate: ['author'] },
    );

    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0];
    expect(pipeline).toEqual([
      {
        $match: {
          visibility: 'public',
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

  it('paginates creator aggregates and preserves the total in one query', async () => {
    quizModelMocks.aggregate.mockResolvedValueOnce([
      {
        items: [
          {
            _id: new Types.ObjectId('507f191e810c19729de860eb'),
            email: 'teacher@example.com',
            role: 'user',
            joinedAt: new Date('2026-06-01T00:00:00.000Z'),
            quizCount: 3,
            totalQuestions: 30,
          },
        ],
        meta: [{ totalItems: 13 }],
      },
    ]);
    const repository = new QuizRepository();

    const result = await repository.findTopCreators({ page: 2, limit: 5 });

    expect(result.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 13,
      itemsPerPage: 5,
      hasNextPage: true,
      hasPrevPage: true,
    });
    expect(result.items).toEqual([
      expect.objectContaining({ id: '507f191e810c19729de860eb', email: 'teacher@example.com' }),
    ]);
    expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
      expect.objectContaining({ $group: expect.any(Object) }),
      // RIN-634: authors are resolved before pagination, and unresolved ones dropped.
      expect.objectContaining({ $lookup: expect.objectContaining({ from: 'users' }) }),
      { $unwind: '$author' },
      { $sort: { quizCount: -1, totalQuestions: -1, _id: 1 } },
      {
        $facet: {
          items: [
            { $skip: 5 },
            { $limit: 5 },
            expect.objectContaining({ $project: expect.any(Object) }),
          ],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ]);
    expect(quizModelMocks.countDocuments).not.toHaveBeenCalled();
  });
});

describe('QuizRepository indexing reads (RIN-840)', () => {
  const ownerId = new Types.ObjectId('507f191e810c19729de860eb');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the owner email out of the quiz author preview', async () => {
    quizModelMocks.aggregate.mockResolvedValue([
      {
        ...quizListRecord,
        author: { _id: ownerId, name: 'QA' },
        ownerIndexing: { email: 'qa-run@fldubai.com', isTestAccount: true },
      },
    ]);
    const repository = new QuizRepository();

    const record = await repository.findMetadataBySlug('algebra-basics');

    expect(record?.owner).toEqual({
      id: String(ownerId),
      email: 'qa-run@fldubai.com',
      isTestAccount: true,
    });
    expect(JSON.stringify(record?.quiz)).not.toContain('fldubai');
    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(pipeline[0]).toEqual({ $match: { slug: 'algebra-basics' } });
    expect(JSON.stringify(pipeline.at(-1))).toContain('ownerIndexing');
  });

  it('returns null owner fields when the owner account is gone', async () => {
    quizModelMocks.aggregate.mockResolvedValue([
      { ...quizListRecord, author: { _id: ownerId }, ownerIndexing: {} },
    ]);
    const repository = new QuizRepository();

    await expect(repository.findMetadataBySlug('algebra-basics')).resolves.toMatchObject({
      owner: { id: String(ownerId), email: null, isTestAccount: null },
    });
  });

  it('loads owner candidates with only the indexing fields', async () => {
    const exec = vi
      .fn()
      .mockResolvedValue([{ _id: ownerId, email: 'qa-run@fldubai.com', isTestAccount: false }]);
    userModelMocks.find.mockReturnValue({ lean: () => ({ exec }) });
    const repository = new QuizRepository();

    await expect(repository.findNonIndexableOwnerCandidates()).resolves.toEqual([
      { id: String(ownerId), email: 'qa-run@fldubai.com', isTestAccount: false },
    ]);
    const [filter, projection] = userModelMocks.find.mock.calls[0] ?? [];
    expect(projection).toEqual({ _id: 1, email: 1, isTestAccount: 1 });
    expect((filter as { $or: unknown[] }).$or).toEqual(
      expect.arrayContaining([{ isTestAccount: true }]),
    );
    expect(filter).toMatchObject({ email: { $nin: [...PUBLIC_CATALOG_OWNER_EMAILS] } });
  });

  it('filters owners and thin quizzes in the sitemap query so the limit counts indexable quizzes', async () => {
    quizModelMocks.aggregate.mockResolvedValue([
      {
        slug: 'algebra-basics',
        title: 'Algebra Basics',
        questionCount: 12,
        leadQuestionTexts: ['What is x?', null],
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    const repository = new QuizRepository();

    await expect(
      repository.findPublicSitemapEntries({ excludeAuthorIds: [String(ownerId)], limit: 5000 }),
    ).resolves.toEqual([
      {
        slug: 'algebra-basics',
        title: 'Algebra Basics',
        questionCount: 12,
        leadQuestionTexts: ['What is x?'],
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(pipeline.slice(0, 3)).toEqual([
      {
        $match: {
          visibility: 'public',
          'questions.4': { $exists: true },
          author: { $nin: [ownerId] },
          // RIN-1341: flagged (no admin clear) and held quizzes never reach the sitemap.
          indexHold: null,
          $nor: [
            { 'contentFlags.personalData': true, 'contentFlags.clearedBy': { $exists: false } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 5000 },
    ]);
    // Only the size and the first question texts, never the whole questions.
    const projection = (pipeline[3] as { $project: Record<string, unknown> }).$project;
    expect(projection).toMatchObject({ _id: 0, slug: 1, title: 1, createdAt: 1, updatedAt: 1 });
    expect(projection).not.toHaveProperty('questions');
    expect(JSON.stringify(projection['leadQuestionTexts'])).toContain('$slice');
    // The sitemap reads no user (RIN-1469).
    expect(JSON.stringify(pipeline)).not.toContain('$lookup');
  });

  // RIN-1469: related-quiz cards show the author, read after the limit with name and avatar only.
  it('reads each author name and avatar after the limit with withAuthor', async () => {
    quizModelMocks.aggregate.mockResolvedValue([
      {
        slug: 'algebra-basics',
        title: 'Algebra Basics',
        questionCount: 12,
        leadQuestionTexts: [],
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        authorIdentity: [{ displayName: 'Fake Teacher', avatar: 'https://example.com/a.png' }],
      },
      {
        slug: 'orphan',
        title: 'Orphan',
        questionCount: 6,
        leadQuestionTexts: [],
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        authorIdentity: [],
      },
    ]);
    const repository = new QuizRepository();

    const rows = await repository.findPublicSitemapEntries({
      excludeAuthorIds: [],
      limit: 40,
      withAuthor: true,
    });

    expect(rows.map((row) => row.author)).toEqual([
      { name: null, displayName: 'Fake Teacher', avatar: 'https://example.com/a.png' },
      null,
    ]);
    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(pipeline[2]).toEqual({ $limit: 40 });
    expect(pipeline[3]).toEqual({
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 0, name: 1, displayName: 1, avatar: 1 } }],
        as: 'authorIdentity',
      },
    });
    expect((pipeline[4] as { $project: Record<string, unknown> }).$project).toMatchObject({
      authorIdentity: 1,
    });
  });

  it('returns the first question texts with the page metadata', async () => {
    quizModelMocks.aggregate.mockResolvedValue([
      {
        ...quizListRecord,
        author: { _id: ownerId },
        ownerIndexing: {},
        leadQuestionTexts: ['Kiểm thử là gì?', 'Mục tiêu?'],
      },
    ]);
    const repository = new QuizRepository();

    const record = await repository.findMetadataBySlug('algebra-basics');

    expect(record?.leadQuestionTexts).toEqual(['Kiểm thử là gì?', 'Mục tiêu?']);
    expect(record?.quiz).not.toHaveProperty('leadQuestionTexts');
    // RIN-1341: the page reads the flag and the hold for its robots rule.
    const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0] as Record<string, unknown>[];
    const project = pipeline.find((stage) => '$project' in stage) as {
      $project: Record<string, unknown>;
    };
    expect(project.$project).toMatchObject({ contentFlags: 1, indexHold: 1 });
  });
});
