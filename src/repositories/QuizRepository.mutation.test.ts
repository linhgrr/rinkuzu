import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

const quizModelMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  findOne: vi.fn(),
  deleteOne: vi.fn(),
  populate: vi.fn(),
  select: vi.fn(),
  lean: vi.fn(),
  updatePopulate: vi.fn(),
  updateLean: vi.fn(),
  session: vi.fn(),
  save: vi.fn(),
  toObject: vi.fn(),
  QuizModelCtor: vi.fn(),
}));

const deleteQuizDependentsMock = vi.hoisted(() => vi.fn());
const deleteOwnedPdfUrlsBestEffortMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const connectDBMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const startSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/mongoose', () => ({
  default: connectDBMock,
}));

vi.mock('@/repositories/helpers/deleteQuizDependents', () => ({
  deleteQuizDependents: deleteQuizDependentsMock,
}));

vi.mock('@/lib/s3', () => ({
  deleteOwnedPdfUrlsBestEffort: deleteOwnedPdfUrlsBestEffortMock,
  getQuizPdfObjectPrefix: (userId: string) => `uploads/quiz_extract/${userId}/`,
}));

vi.mock('@/models/Quiz', () => {
  const QuizModel = Object.assign(quizModelMocks.QuizModelCtor, {
    aggregate: quizModelMocks.aggregate,
    countDocuments: quizModelMocks.countDocuments,
    findById: quizModelMocks.findById,
    findByIdAndUpdate: quizModelMocks.findByIdAndUpdate,
    findOne: quizModelMocks.findOne,
    deleteOne: quizModelMocks.deleteOne,
  });
  return { default: QuizModel };
});

vi.mock('mongoose', async () => {
  const actual = await vi.importActual<typeof import('mongoose')>('mongoose');
  return {
    ...actual,
    default: {
      ...actual.default,
      startSession: startSessionMock,
    },
    startSession: startSessionMock,
  };
});

import { QuizRepository } from '@/repositories/QuizRepository';

const QUIZ_ID = '507f191e810c19729de860ea';
const AUTHOR_ID = '507f191e810c19729de860eb';
const FOLDER_ID = '507f191e810c19729de860ec';

const quizRecord = {
  _id: new Types.ObjectId(QUIZ_ID),
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: new Types.ObjectId(AUTHOR_ID),
  folder: null,
  questions: [
    {
      _id: new Types.ObjectId('507f191e810c19729de860ed'),
      question: '2+2?',
      options: ['3', '4'],
      type: 'single' as const,
      correctIndex: 1,
    },
  ],
  questionCount: 1,
  visibility: 'public',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

const populatedAuthorRecord = {
  ...quizRecord,
  author: {
    _id: new Types.ObjectId(AUTHOR_ID),
    email: 'author@example.com',
    name: 'Author',
    displayName: 'Author Name',
    avatar: 'https://cdn.example/a.png',
  },
};

function chainFindByIdLean(value: unknown) {
  quizModelMocks.lean.mockResolvedValue(value);
  quizModelMocks.populate.mockReturnValue({ lean: quizModelMocks.lean });
  quizModelMocks.select.mockReturnValue({ lean: quizModelMocks.lean });
  quizModelMocks.findById.mockReturnValue({
    populate: quizModelMocks.populate,
    select: quizModelMocks.select,
  });
}

function chainFindOneLean(value: unknown) {
  quizModelMocks.lean.mockResolvedValue(value);
  quizModelMocks.populate.mockReturnValue({ lean: quizModelMocks.lean });
  quizModelMocks.select.mockReturnValue({ lean: quizModelMocks.lean });
  quizModelMocks.findOne.mockReturnValue({
    populate: quizModelMocks.populate,
    select: quizModelMocks.select,
  });
}

describe('QuizRepository mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectDBMock.mockResolvedValue(undefined);
    quizModelMocks.aggregate.mockResolvedValue([]);
    quizModelMocks.countDocuments.mockResolvedValue(0);
    quizModelMocks.deleteOne.mockReturnValue({
      session: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    quizModelMocks.QuizModelCtor.mockImplementation(function QuizModelCtor(
      this: { save: typeof quizModelMocks.save; toObject: typeof quizModelMocks.toObject },
      data: unknown,
    ) {
      this.save = quizModelMocks.save;
      this.toObject = quizModelMocks.toObject;
      Object.assign(this, data as object);
      return this;
    });
    quizModelMocks.save.mockResolvedValue(undefined);
    quizModelMocks.toObject.mockReturnValue(quizRecord);
    quizModelMocks.findByIdAndUpdate.mockReturnValue({
      populate: quizModelMocks.updatePopulate,
    });
    quizModelMocks.updatePopulate.mockReturnValue({ lean: quizModelMocks.updateLean });
    quizModelMocks.updateLean.mockResolvedValue(null);
  });

  describe('read by id / slug / source draft', () => {
    it('loads a full quiz by id with author populate fields and maps null to null', async () => {
      chainFindByIdLean(populatedAuthorRecord);
      const repository = new QuizRepository();

      await expect(repository.findById(QUIZ_ID)).resolves.toMatchObject({
        id: QUIZ_ID,
        title: 'Algebra Basics',
        author: {
          id: AUTHOR_ID,
          email: 'author@example.com',
          displayName: 'Author Name',
        },
      });
      expect(quizModelMocks.findById).toHaveBeenCalledWith(QUIZ_ID);
      expect(quizModelMocks.populate).toHaveBeenCalledWith(
        'author',
        'email name displayName avatar',
      );

      chainFindByIdLean(null);
      await expect(repository.findById(QUIZ_ID)).resolves.toBeNull();
    });

    it('returns summary projection pipelines without question payloads', async () => {
      quizModelMocks.aggregate.mockResolvedValueOnce([
        {
          ...populatedAuthorRecord,
          questions: [],
          questionCount: 1,
        },
      ]);
      const repository = new QuizRepository();

      await expect(repository.findSummaryBySlug('algebra-basics')).resolves.toMatchObject({
        id: QUIZ_ID,
        questionCount: 1,
        questions: [],
        author: { id: AUTHOR_ID, email: 'author@example.com' },
      });

      const pipeline = quizModelMocks.aggregate.mock.calls[0]?.[0] as unknown[];
      expect(pipeline).toEqual(
        expect.arrayContaining([
          { $match: { slug: 'algebra-basics' } },
          { $limit: 1 },
          expect.objectContaining({
            $project: expect.objectContaining({
              questions: { $literal: [] },
              questionCount: { $size: { $ifNull: ['$questions', []] } },
              author: expect.objectContaining({
                displayName: { $first: '$authorDoc.displayName' },
                avatar: { $first: '$authorDoc.avatar' },
              }),
            }),
          }),
        ]),
      );

      quizModelMocks.aggregate.mockResolvedValueOnce([]);
      await expect(repository.findSummaryBySlug('missing')).resolves.toBeNull();
    });

    it('returns only the quiz id string for findIdBySlug', async () => {
      chainFindOneLean({ _id: new Types.ObjectId(QUIZ_ID) });
      const repository = new QuizRepository();

      await expect(repository.findIdBySlug('algebra-basics')).resolves.toBe(QUIZ_ID);
      expect(quizModelMocks.findOne).toHaveBeenCalledWith({ slug: 'algebra-basics' });
      expect(quizModelMocks.select).toHaveBeenCalledWith('_id');

      chainFindOneLean(null);
      await expect(repository.findIdBySlug('missing')).resolves.toBeNull();
    });

    it('loads quizzes by sourceDraftId with author populate', async () => {
      chainFindOneLean(populatedAuthorRecord);
      const repository = new QuizRepository();

      await expect(repository.findBySourceDraftId('draft-1')).resolves.toMatchObject({
        id: QUIZ_ID,
        author: { id: AUTHOR_ID },
      });
      expect(quizModelMocks.findOne).toHaveBeenCalledWith({ sourceDraftId: 'draft-1' });
      expect(quizModelMocks.populate).toHaveBeenCalledWith(
        'author',
        'email name displayName avatar',
      );

      chainFindOneLean(null);
      await expect(repository.findBySourceDraftId('missing')).resolves.toBeNull();
    });
  });

  describe('create / update / delete', () => {
    it('creates a quiz document and maps the persisted object', async () => {
      const repository = new QuizRepository();
      const created = await repository.create({
        title: 'Algebra Basics',
        slug: 'algebra-basics',
        author: AUTHOR_ID,
        questions: [],
        visibility: 'public',
      });

      expect(quizModelMocks.QuizModelCtor).toHaveBeenCalledOnce();
      expect(quizModelMocks.save).toHaveBeenCalledOnce();
      expect(created).toMatchObject({
        id: QUIZ_ID,
        title: 'Algebra Basics',
        slug: 'algebra-basics',
      });
    });

    it('updates with validators and author populate, returning null when missing', async () => {
      quizModelMocks.updateLean.mockResolvedValueOnce(populatedAuthorRecord);
      const repository = new QuizRepository();

      await expect(repository.update(QUIZ_ID, { title: 'Updated title' })).resolves.toMatchObject({
        id: QUIZ_ID,
        title: 'Algebra Basics',
        author: { id: AUTHOR_ID },
      });
      expect(quizModelMocks.findByIdAndUpdate).toHaveBeenCalledWith(
        QUIZ_ID,
        { title: 'Updated title' },
        { new: true, runValidators: true },
      );
      expect(quizModelMocks.updatePopulate).toHaveBeenCalledWith(
        'author',
        'email name displayName avatar',
      );

      quizModelMocks.updateLean.mockResolvedValueOnce(null);
      await expect(repository.update(QUIZ_ID, { title: 'x' })).resolves.toBeNull();
    });

    it('deletes dependent data in a transaction and reports whether a quiz row was removed', async () => {
      // Match repository session usage: withTransaction closes over startSession's session.
      const session: ClientSession = Object.assign(Object.create(null), {
        withTransaction: vi.fn(async (callback: () => Promise<void>) => {
          await callback();
        }),
        endSession: vi.fn().mockResolvedValue(undefined),
      });
      startSessionMock.mockResolvedValue(session);

      const deleteSession = vi.fn().mockResolvedValue({ deletedCount: 1 });
      quizModelMocks.deleteOne.mockReturnValue({ session: deleteSession });

      const leanSession = vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(QUIZ_ID),
        slug: 'algebra-basics',
        author: new Types.ObjectId(AUTHOR_ID),
        pdfUrl: 'https://cdn.example.com/test-bucket/uploads/quiz_extract/doc.pdf',
      });
      quizModelMocks.session.mockReturnValue({ lean: leanSession });
      quizModelMocks.select.mockReturnValue({ session: quizModelMocks.session });
      quizModelMocks.findById.mockReturnValue({ select: quizModelMocks.select });

      const repository = new QuizRepository();
      await expect(repository.delete(QUIZ_ID)).resolves.toBe(true);

      expect(deleteQuizDependentsMock).toHaveBeenCalledWith(
        [{ id: expect.any(Types.ObjectId), slug: 'algebra-basics' }],
        session,
      );
      expect(quizModelMocks.select).toHaveBeenCalledWith('_id slug author pdfUrl');
      expect(deleteSession).toHaveBeenCalledWith(session);
      expect(deleteOwnedPdfUrlsBestEffortMock).toHaveBeenCalledWith(
        ['https://cdn.example.com/test-bucket/uploads/quiz_extract/doc.pdf'],
        `uploads/quiz_extract/${AUTHOR_ID}/`,
      );
      expect(session.endSession).toHaveBeenCalledOnce();

      // missing quiz short-circuits without dependents cleanup or S3 work
      const leanMissing = vi.fn().mockResolvedValue(null);
      quizModelMocks.session.mockReturnValue({ lean: leanMissing });
      deleteQuizDependentsMock.mockClear();
      deleteOwnedPdfUrlsBestEffortMock.mockClear();
      await expect(repository.delete(QUIZ_ID)).resolves.toBe(false);
      expect(deleteQuizDependentsMock).not.toHaveBeenCalled();
      expect(deleteOwnedPdfUrlsBestEffortMock).not.toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalledTimes(2);

      // deletedCount !== 1 reports false and skips external cleanup
      const leanPresent = vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(QUIZ_ID),
        slug: 'algebra-basics',
        author: new Types.ObjectId(AUTHOR_ID),
        pdfUrl: 'https://cdn.example.com/test-bucket/uploads/quiz_extract/doc.pdf',
      });
      quizModelMocks.session.mockReturnValue({ lean: leanPresent });
      quizModelMocks.deleteOne.mockReturnValue({
        session: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      });
      await expect(repository.delete(QUIZ_ID)).resolves.toBe(false);
      expect(deleteOwnedPdfUrlsBestEffortMock).not.toHaveBeenCalled();
    });
  });

  describe('list / filter / pagination edge cases', () => {
    it('returns empty pages when facet aggregate is empty or meta has no total row', async () => {
      quizModelMocks.aggregate.mockResolvedValueOnce([]);
      const repository = new QuizRepository();

      const empty = await repository.findUserQuizzes(AUTHOR_ID, { page: 1, limit: 10 });
      expect(empty.items).toEqual([]);
      expect(empty.pagination).toMatchObject({
        currentPage: 1,
        totalItems: 0,
        itemsPerPage: 10,
        totalPages: 0,
      });

      quizModelMocks.aggregate.mockResolvedValueOnce([{ items: [quizRecord], meta: [] }]);
      const missingMeta = await repository.findPublicByAuthor(AUTHOR_ID, {
        page: 3,
        limit: 5,
      });
      expect(missingMeta.items).toHaveLength(1);
      expect(missingMeta.pagination.totalItems).toBe(0);
      expect(missingMeta.pagination.currentPage).toBe(3);

      const pipeline = quizModelMocks.aggregate.mock.calls[1]?.[0] as Array<
        Record<string, unknown>
      >;
      expect(pipeline[0]).toEqual({
        $match: { author: new Types.ObjectId(AUTHOR_ID), visibility: 'public' },
      });
      expect(pipeline[2]).toEqual({
        $facet: {
          items: [
            { $skip: 10 },
            { $limit: 5 },
            {
              $project: expect.objectContaining({
                questions: { $literal: [] },
                questionCount: { $size: { $ifNull: ['$questions', []] } },
              }),
            },
          ],
          meta: [{ $count: 'totalItems' }],
        },
      });
    });

    it('normalizes string folder/author filters and excludeAuthor ObjectIds', async () => {
      const repository = new QuizRepository();

      await repository.findAll(
        {
          folder: FOLDER_ID,
          author: AUTHOR_ID,
          visibility: 'personal',
        },
        { page: 2, limit: 4 },
      );

      expect(quizModelMocks.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              folder: new Types.ObjectId(FOLDER_ID),
              author: new Types.ObjectId(AUTHOR_ID),
              visibility: 'personal',
            },
          },
          { $sort: { createdAt: -1 } },
          { $skip: 4 },
          { $limit: 4 },
        ]),
      );
      expect(quizModelMocks.countDocuments).toHaveBeenCalledWith({
        folder: new Types.ObjectId(FOLDER_ID),
        author: new Types.ObjectId(AUTHOR_ID),
        visibility: 'personal',
      });

      await repository.findRecent(
        { excludeAuthor: AUTHOR_ID, visibility: 'public' },
        { limit: 3, populate: ['author'] },
      );
      expect(quizModelMocks.aggregate).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          {
            $match: {
              visibility: 'public',
              author: { $ne: new Types.ObjectId(AUTHOR_ID) },
            },
          },
        ]),
      );

      await repository.findRecent({ excludeAuthor: 'not-an-object-id' }, { limit: 1 });
      expect(quizModelMocks.aggregate).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          {
            $match: {
              author: { $ne: 'not-an-object-id' },
            },
          },
        ]),
      );
    });

    it('does not cast non-ObjectId folder/author strings and defaults findAll sort', async () => {
      const repository = new QuizRepository();

      await repository.findAll(
        { folder: 'unfiled', author: 'legacy-author' },
        { page: 1, limit: 2 },
      );

      expect(quizModelMocks.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: {
              folder: 'unfiled',
              author: 'legacy-author',
            },
          },
          { $sort: { createdAt: -1 } },
          { $skip: 0 },
          { $limit: 2 },
        ]),
      );
    });

    it('accepts non-ObjectId user ids in findUserQuizzes filters', async () => {
      quizModelMocks.aggregate.mockResolvedValueOnce([{ items: [], meta: [{ totalItems: 0 }] }]);
      const repository = new QuizRepository();

      await repository.findUserQuizzes('legacy-user', { page: 1, limit: 10 });
      expect(quizModelMocks.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([{ $match: { author: 'legacy-user' } }]),
      );
    });
  });

  describe('counts and top creators', () => {
    it('counts documents and created-at buckets', async () => {
      quizModelMocks.countDocuments.mockResolvedValueOnce(7);
      quizModelMocks.aggregate.mockResolvedValueOnce([
        { _id: null, today: 1, thisWeek: 3, thisMonth: 7 },
      ]);
      const repository = new QuizRepository();

      await expect(repository.count({ createdAt: { $gte: new Date('2026-01-01') } })).resolves.toBe(
        7,
      );
      expect(quizModelMocks.countDocuments).toHaveBeenCalledWith({
        createdAt: { $gte: new Date('2026-01-01') },
      });

      const thresholds = {
        today: new Date('2026-07-16'),
        thisWeek: new Date('2026-07-10'),
        thisMonth: new Date('2026-06-17'),
      };
      await expect(repository.countByCreatedAtBuckets(thresholds)).resolves.toEqual({
        today: 1,
        thisWeek: 3,
        thisMonth: 7,
      });
      expect(quizModelMocks.aggregate).toHaveBeenCalledWith([
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

      quizModelMocks.aggregate.mockResolvedValueOnce([]);
      await expect(repository.countByCreatedAtBuckets(thresholds)).resolves.toEqual({
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      });
    });

    it('maps creator aggregates and rejects incomplete creator rows', async () => {
      quizModelMocks.aggregate.mockResolvedValueOnce([
        {
          items: [
            {
              _id: new Types.ObjectId(AUTHOR_ID),
              email: 'teacher@example.com',
              role: 'user',
              joinedAt: new Date('2026-06-01T00:00:00.000Z'),
              quizCount: 4,
              totalQuestions: 40,
            },
          ],
          meta: [{ totalItems: 1 }],
        },
      ]);
      const repository = new QuizRepository();

      await expect(repository.findTopCreators({ page: 1, limit: 10 })).resolves.toEqual({
        items: [
          {
            id: AUTHOR_ID,
            email: 'teacher@example.com',
            role: 'user',
            joinedAt: new Date('2026-06-01T00:00:00.000Z'),
            quizCount: 4,
            totalQuestions: 40,
          },
        ],
        pagination: expect.objectContaining({
          currentPage: 1,
          totalItems: 1,
          itemsPerPage: 10,
        }),
      });

      quizModelMocks.aggregate.mockResolvedValueOnce([]);
      const empty = await repository.findTopCreators({ page: 1, limit: 5 });
      expect(empty.items).toEqual([]);
      expect(empty.pagination.totalItems).toBe(0);

      quizModelMocks.aggregate.mockResolvedValueOnce([
        {
          items: [
            {
              _id: new Types.ObjectId(AUTHOR_ID),
              email: '',
              role: 'user',
              joinedAt: new Date('2026-06-01T00:00:00.000Z'),
              quizCount: 1,
              totalQuestions: 1,
            },
          ],
          meta: [{ totalItems: 1 }],
        },
      ]);
      await expect(repository.findTopCreators({ page: 1, limit: 5 })).rejects.toThrow(
        `Quiz creator ${AUTHOR_ID} could not be resolved`,
      );

      quizModelMocks.aggregate.mockResolvedValueOnce([
        {
          items: [
            {
              _id: new Types.ObjectId(AUTHOR_ID),
              email: 'ok@example.com',
              role: undefined,
              joinedAt: new Date('2026-06-01T00:00:00.000Z'),
              quizCount: 1,
              totalQuestions: 1,
            },
          ],
          meta: [{ totalItems: 1 }],
        },
      ]);
      await expect(repository.findTopCreators({ page: 1, limit: 5 })).rejects.toThrow(TypeError);

      quizModelMocks.aggregate.mockResolvedValueOnce([
        {
          items: [
            {
              _id: new Types.ObjectId(AUTHOR_ID),
              email: 'ok@example.com',
              role: 'admin',
              joinedAt: undefined,
              quizCount: 1,
              totalQuestions: 1,
            },
          ],
          meta: [{ totalItems: 1 }],
        },
      ]);
      await expect(repository.findTopCreators({ page: 1, limit: 5 })).rejects.toThrow(
        /could not be resolved/,
      );
    });
  });
});
