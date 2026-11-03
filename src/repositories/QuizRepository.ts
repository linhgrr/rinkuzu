import connectDB from '@/lib/mongoose';
import { logger } from '@/lib/logger';
import QuizModel from '@/models/Quiz';
import FolderQuiz from '@/models/FolderQuiz';
import type { Quiz, QuizQuestionContent } from '@/entities/Quiz';
import {
  IQuizRepository,
  type CreateQuizData,
  type QuizCreatorStatRecord,
  type QuizFindFilter,
  type QuizFindOptions,
  type UpdateQuizData,
} from '@/interfaces/repositories/IQuizRepository';
import type {
  DashboardRecentQuizOptions,
  IDashboardQuizRepository,
} from '@/interfaces/repositories/IDashboardQuizRepository';
import type {
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import { buildPaginationMeta } from '@/lib/pagination';
import mongoose, { Types, type FilterQuery, type PipelineStage } from 'mongoose';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizPersistenceRecord } from '@/repositories/types/QuizPersistence';
import { serializeId } from '@/lib/mongo-id';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';
import { deleteQuizDependents } from '@/repositories/helpers/deleteQuizDependents';
import { buildCompactQuizPipeline } from '@/repositories/pipelines/quiz-list.mjs';
import { buildPaginatedCreatorStatsPipeline } from '@/repositories/pipelines/creator-stats.mjs';
import { deleteOwnedPdfUrlsBestEffort, getQuizPdfObjectPrefix } from '@/lib/s3';

interface QuizListAggregateMeta {
  totalItems: number;
}

interface QuizListAggregateResult {
  items: QuizPersistenceRecord[];
  meta: QuizListAggregateMeta[];
}

interface QuizCreatorAggregateRecord {
  _id: Types.ObjectId;
  email: string;
  role: 'admin' | 'user';
  joinedAt: Date;
  quizCount: number;
  totalQuestions: number;
}

interface QuizCreatorAggregateResult {
  items: QuizCreatorAggregateRecord[];
  meta: QuizListAggregateMeta[];
}

interface PaginatedQuizListPipelineOptions {
  limit: number;
  placementOwnerId?: Types.ObjectId;
  projection: PipelineStage.Project['$project'];
  skip: number;
}

interface PaginatedQuizListQueryOptions extends RepositoryPaginationOptions {
  placementOwnerId?: Types.ObjectId;
  projection: PipelineStage.Project['$project'];
}

const QUIZ_LIST_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  author: 1,
  questions: { $literal: [] },
  questionCount: { $size: { $ifNull: ['$questions', []] } },
  visibility: 1,
  createdAt: 1,
  updatedAt: 1,
};

const USER_QUIZ_LIST_PROJECTION = {
  ...QUIZ_LIST_PROJECTION,
  folder: 1,
  pdfUrl: 1,
  tags: 1,
  sourceDraftId: 1,
};

/** Public quiz author projection — stable non-PII fields only (no email). */
const QUIZ_WITH_AUTHOR_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  author: {
    _id: { $ifNull: [{ $first: '$authorDoc._id' }, '$author'] },
    name: { $first: '$authorDoc.name' },
    displayName: { $first: '$authorDoc.displayName' },
    avatar: { $first: '$authorDoc.avatar' },
  },
  folder: 1,
  visibility: 1,
  pdfUrl: 1,
  tags: 1,
  sourceDraftId: 1,
  createdAt: 1,
  updatedAt: 1,
} satisfies PipelineStage.Project['$project'];

const QUIZ_DETAIL_PROJECTION = {
  ...QUIZ_WITH_AUTHOR_PROJECTION,
  questions: 1,
} satisfies PipelineStage.Project['$project'];

const QUIZ_SUMMARY_PROJECTION = {
  ...QUIZ_WITH_AUTHOR_PROJECTION,
  questions: { $literal: [] },
  questionCount: { $size: { $ifNull: ['$questions', []] } },
} satisfies PipelineStage.Project['$project'];

function buildFolderPlacementStages(ownerId: Types.ObjectId): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'folderquizzes',
        let: { quizId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$quiz', '$$quizId'] }, { $eq: ['$owner', ownerId] }],
              },
            },
          },
          { $project: { _id: 0, folder: 1 } },
          { $limit: 1 },
        ],
        as: 'folderPlacement',
      },
    },
    { $set: { folder: { $ifNull: [{ $first: '$folderPlacement.folder' }, null] } } },
    { $unset: 'folderPlacement' },
  ];
}

function buildPaginatedQuizListPipeline(
  filter: FilterQuery<QuizPersistenceRecord>,
  options: PaginatedQuizListPipelineOptions,
): PipelineStage[] {
  return [
    ...(options.placementOwnerId ? buildFolderPlacementStages(options.placementOwnerId) : []),
    { $match: filter },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [
          { $skip: options.skip },
          { $limit: options.limit },
          { $project: options.projection },
        ],
        meta: [{ $count: 'totalItems' }],
      },
    },
  ];
}

async function findPaginatedQuizList(
  filter: FilterQuery<QuizPersistenceRecord>,
  options: PaginatedQuizListQueryOptions,
): Promise<PaginatedRepositoryResult<Quiz>> {
  const { page, limit, placementOwnerId, projection } = options;
  const [result] = await QuizModel.aggregate<QuizListAggregateResult>(
    buildPaginatedQuizListPipeline(filter, {
      limit,
      ...(placementOwnerId ? { placementOwnerId } : {}),
      projection,
      skip: (page - 1) * limit,
    }),
  );
  const records = result?.items ?? [];
  const total = result?.meta[0]?.totalItems ?? 0;

  return {
    items: records.map(QuizPersistenceMapper.toEntity),
    pagination: buildPaginationMeta(page, limit, total),
  };
}

async function findQuizBySlugWithProjection(
  slug: string,
  projection: PipelineStage.Project['$project'],
): Promise<Quiz | null> {
  await connectDB();
  const [record] = await QuizModel.aggregate<QuizPersistenceRecord>([
    { $match: { slug } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'users',
        localField: 'author',
        foreignField: '_id',
        as: 'authorDoc',
      },
    },
    { $project: projection },
  ]);

  return record ? QuizPersistenceMapper.toEntity(record) : null;
}

function persistenceAuthorId(author: QuizPersistenceRecord['author']): string {
  return serializeId(
    typeof author === 'object' && '_id' in author ? author._id : author,
    'quiz.author',
  );
}

async function mapQuizWithOwnerPlacement(record: QuizPersistenceRecord): Promise<Quiz> {
  const placement = await FolderQuiz.findOne({
    owner: new Types.ObjectId(persistenceAuthorId(record.author)),
    quiz: new Types.ObjectId(serializeId(record._id, 'quiz._id')),
  })
    .select('folder')
    .lean<{ folder: Types.ObjectId }>();
  return {
    ...QuizPersistenceMapper.toEntity(record),
    folder: placement ? String(placement.folder) : null,
  };
}

function toPersistenceFilter(filter: QuizFindFilter): FilterQuery<QuizPersistenceRecord> {
  const { excludeAuthor, ...rest } = filter;
  const normalizedFilter: FilterQuery<QuizPersistenceRecord> = { ...rest };

  if (
    typeof normalizedFilter.folder === 'string' &&
    Types.ObjectId.isValid(normalizedFilter.folder)
  ) {
    normalizedFilter.folder = new Types.ObjectId(normalizedFilter.folder);
  }
  if (
    typeof normalizedFilter.author === 'string' &&
    Types.ObjectId.isValid(normalizedFilter.author)
  ) {
    normalizedFilter.author = new Types.ObjectId(normalizedFilter.author);
  }
  if (excludeAuthor) {
    normalizedFilter.author = {
      $ne: Types.ObjectId.isValid(excludeAuthor)
        ? new Types.ObjectId(excludeAuthor)
        : excludeAuthor,
    };
  }

  return normalizedFilter;
}

export class QuizRepository implements IQuizRepository, IDashboardQuizRepository {
  async findById(id: string): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findById(id)
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? mapQuizWithOwnerPlacement(record) : null;
  }

  async findAccessById(id: string): Promise<Pick<Quiz, 'id' | 'author' | 'visibility'> | null> {
    await connectDB();
    const record = await QuizModel.findById(id)
      .select('_id author visibility')
      .lean<Pick<QuizPersistenceRecord, '_id' | 'author' | 'visibility'>>();

    return record
      ? {
          id: serializeId(record._id, 'quiz._id'),
          author: serializeId(record.author, 'quiz.author'),
          visibility: record.visibility,
        }
      : null;
  }

  async findBySlug(slug: string): Promise<Quiz | null> {
    return findQuizBySlugWithProjection(slug, QUIZ_DETAIL_PROJECTION);
  }

  async findSummaryBySlug(slug: string): Promise<Quiz | null> {
    return findQuizBySlugWithProjection(slug, QUIZ_SUMMARY_PROJECTION);
  }

  async findIdBySlug(slug: string): Promise<string | null> {
    await connectDB();
    const record = await QuizModel.findOne({ slug }).select('_id').lean<{ _id: Types.ObjectId }>();
    return record ? String(record._id) : null;
  }

  async findCanonicalSlugByAlias(alias: string): Promise<string | null> {
    await connectDB();
    const record = await QuizModel.findOne({ slugAliases: alias })
      .select('slug')
      .lean<{ slug: string }>();
    return record ? record.slug : null;
  }

  async findBySourceDraftId(sourceDraftId: string): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findOne({ sourceDraftId })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? mapQuizWithOwnerPlacement(record) : null;
  }

  async create(quizData: CreateQuizData): Promise<Quiz> {
    await connectDB();
    const { folder, ...quizFields } = quizData;
    const session = await mongoose.startSession();
    try {
      // Return the callback's result: withTransaction retries on a transient
      // error, and a captured outer variable keeps the losing attempt's value.
      const record = await session.withTransaction(async () => {
        const document = new QuizModel(quizFields);
        await document.save({ session });
        if (folder) {
          await FolderQuiz.updateOne(
            { owner: new Types.ObjectId(quizData.author), quiz: document._id },
            { $set: { folder: new Types.ObjectId(folder) } },
            { upsert: true, session },
          );
        }
        return document.toObject() as QuizPersistenceRecord;
      });
      if (!record) throw new Error('Quiz creation transaction did not commit');
      return { ...QuizPersistenceMapper.toEntity(record), folder: folder ?? null };
    } finally {
      await session.endSession();
    }
  }

  async update(id: string, quizData: UpdateQuizData): Promise<Quiz | null> {
    await connectDB();
    const hasFolderCommand = Object.hasOwn(quizData, 'folder');
    const { folder, ...quizFields } = quizData;
    if (!hasFolderCommand) {
      const record = await QuizModel.findByIdAndUpdate(id, quizFields, {
        new: true,
        runValidators: true,
      })
        .populate('author', 'email name displayName avatar')
        .lean<QuizPersistenceRecord>();
      return record ? mapQuizWithOwnerPlacement(record) : null;
    }
    const session = await mongoose.startSession();
    try {
      // Return the callback's result: withTransaction retries on a transient
      // error, and a captured outer variable keeps the losing attempt's value.
      const record = await session.withTransaction(async () => {
        const updated = await QuizModel.findByIdAndUpdate(id, quizFields, {
          new: true,
          runValidators: true,
          session,
        })
          .populate('author', 'email name displayName avatar')
          .lean<QuizPersistenceRecord>();
        if (!updated || !hasFolderCommand) return updated;

        const placementFilter = {
          owner: new Types.ObjectId(persistenceAuthorId(updated.author)),
          quiz: new Types.ObjectId(id),
        };
        if (folder) {
          await FolderQuiz.updateOne(
            placementFilter,
            { $set: { folder: new Types.ObjectId(folder) } },
            { upsert: true, session },
          );
        } else {
          await FolderQuiz.deleteOne(placementFilter).session(session);
        }

        return updated;
      });
      return record ? mapQuizWithOwnerPlacement(record) : null;
    } finally {
      await session.endSession();
    }
  }

  async updateQuestionById(
    quizId: string,
    questionId: string,
    question: QuizQuestionContent,
  ): Promise<boolean> {
    await connectDB();

    const $set: Record<string, unknown> = {
      'questions.$.question': question.question,
      'questions.$.options': question.options,
      'questions.$.type': question.type,
      ...(question.type === 'single'
        ? { 'questions.$.correctIndex': question.correctIndex }
        : { 'questions.$.correctIndexes': question.correctIndexes }),
      ...(question.questionImage !== undefined
        ? { 'questions.$.questionImage': question.questionImage }
        : {}),
      ...(question.optionImages !== undefined
        ? { 'questions.$.optionImages': question.optionImages }
        : {}),
    };
    const $unset: Record<string, 1> = {
      ...(question.type === 'single'
        ? { 'questions.$.correctIndexes': 1 as const }
        : { 'questions.$.correctIndex': 1 as const }),
      ...(question.questionImage === undefined ? { 'questions.$.questionImage': 1 as const } : {}),
      ...(question.optionImages === undefined ? { 'questions.$.optionImages': 1 as const } : {}),
    };

    const result = await QuizModel.updateOne(
      { _id: quizId, 'questions._id': questionId },
      { $set, $unset },
      { runValidators: true },
    );
    return result.matchedCount === 1;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    try {
      // Return the callback's result: withTransaction retries on a transient
      // error, and captured outer variables keep the losing attempt's values.
      // Three of them were captured here, and the object-storage cleanup below
      // reads all three -- a retry that took the `if (!quiz) return` path would
      // have deleted a PDF belonging to the attempt that rolled back.
      const outcome = await session.withTransaction(async () => {
        const quiz = await QuizModel.findById(id)
          .select('_id slug author pdfUrl')
          .session(session)
          .lean<{
            _id: Types.ObjectId;
            slug: string;
            author: Types.ObjectId;
            pdfUrl?: string;
          } | null>();
        if (!quiz) return null;

        await deleteQuizDependents([{ id: quiz._id, slug: quiz.slug }], session);

        const result = await QuizModel.deleteOne({ _id: quiz._id }).session(session);
        return {
          deleted: result.deletedCount === 1,
          pdfUrl: quiz.pdfUrl,
          authorId: quiz.author.toString(),
        };
      });

      // External object storage cleanup is best-effort and runs only after a
      // successful Mongo transaction commit (never inside the transaction).
      if (outcome?.deleted) {
        await deleteOwnedPdfUrlsBestEffort(
          [outcome.pdfUrl],
          getQuizPdfObjectPrefix(outcome.authorId),
        );
      }

      return outcome?.deleted ?? false;
    } finally {
      await session.endSession();
    }
  }

  async findAll(
    filter: QuizFindFilter,
    options: QuizFindOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const sort = options.sort || { createdAt: -1 };
    const normalizedFilter = toPersistenceFilter(filter);
    const placementOwnerId =
      filter.folder !== undefined &&
      typeof filter.author === 'string' &&
      Types.ObjectId.isValid(filter.author)
        ? new Types.ObjectId(filter.author)
        : null;
    if (filter.folder !== undefined && !placementOwnerId) {
      throw new TypeError('Folder-filtered quiz queries require a concrete owner');
    }
    if (placementOwnerId) {
      const [records, totals] = await Promise.all([
        QuizModel.aggregate<QuizPersistenceRecord>([
          ...buildFolderPlacementStages(placementOwnerId),
          ...buildCompactQuizPipeline(normalizedFilter, {
            limit,
            populateAuthor: true,
            skip,
            sort,
          }),
        ]),
        QuizModel.aggregate<{ total: number }>([
          ...buildFolderPlacementStages(placementOwnerId),
          { $match: normalizedFilter },
          { $count: 'total' },
        ]),
      ]);
      return {
        items: records.map(QuizPersistenceMapper.toEntity),
        pagination: buildPaginationMeta(page, limit, totals[0]?.total ?? 0),
      };
    }
    const totalPromise =
      Object.keys(normalizedFilter).length === 0
        ? QuizModel.countDocuments(normalizedFilter, { hint: '_id_' })
        : QuizModel.countDocuments(normalizedFilter);
    const [records, total] = await Promise.all([
      QuizModel.aggregate<QuizPersistenceRecord>(
        buildCompactQuizPipeline(normalizedFilter, {
          limit,
          populateAuthor: true,
          skip,
          sort,
        }),
      ),
      totalPromise,
    ]);

    return {
      items: records.map(QuizPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async findRecent(filter: QuizFindFilter, options: DashboardRecentQuizOptions): Promise<Quiz[]> {
    await connectDB();
    const records = await QuizModel.aggregate<QuizPersistenceRecord>(
      buildCompactQuizPipeline(toPersistenceFilter(filter), {
        limit: options.limit,
        populateAuthor: options.populate?.includes('author') ?? false,
        skip: 0,
        sort: options.sort ?? { createdAt: -1 },
      }),
    );
    return records.map(QuizPersistenceMapper.toEntity);
  }

  async findForPlay(slug: string): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findOne({ slug })
      .select(
        '_id title description slug author questions visibility pdfUrl tags sourceDraftId createdAt updatedAt',
      )
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async findUserQuizzes(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>> {
    await connectDB();

    const filter: FilterQuery<QuizPersistenceRecord> = {
      author: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
    };
    return findPaginatedQuizList(filter, {
      ...options,
      placementOwnerId: new Types.ObjectId(userId),
      projection: USER_QUIZ_LIST_PROJECTION,
    });
  }

  async findPublicByAuthor(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>> {
    await connectDB();
    const filter = { author: new Types.ObjectId(userId), visibility: 'public' as const };
    return findPaginatedQuizList(filter, {
      ...options,
      projection: QUIZ_LIST_PROJECTION,
    });
  }

  async count(filter: CreatedAtCountFilter = {}): Promise<number> {
    await connectDB();
    return QuizModel.countDocuments(filter);
  }

  async countByCreatedAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets> {
    await connectDB();
    const records = await QuizModel.aggregate<CountBucketAggregateRecord>(
      buildCountBucketsPipeline('createdAt', thresholds),
    );
    return resolveCountBuckets(records);
  }

  async findTopCreators(
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<QuizCreatorStatRecord>> {
    await connectDB();

    const { page, limit } = options;
    const [result] = await QuizModel.aggregate<QuizCreatorAggregateResult>(
      buildPaginatedCreatorStatsPipeline({ page, limit }),
    );
    const records = result?.items ?? [];
    const total = result?.meta[0]?.totalItems ?? 0;

    // The pipeline already drops creators without a user document. A record
    // that still lacks a required field (a user document missing email, role or
    // createdAt) is skipped rather than failing the whole admin Overview.
    const items: QuizCreatorStatRecord[] = [];
    for (const record of records) {
      if (!record.email || !record.role || !record.joinedAt) {
        logger.warn(
          { creatorId: String(record._id) },
          'Skipping top creator with an incomplete user record',
        );
        continue;
      }
      items.push({
        id: String(record._id),
        email: record.email,
        role: record.role,
        joinedAt: record.joinedAt,
        quizCount: record.quizCount,
        totalQuestions: record.totalQuestions,
      });
    }

    return {
      items,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}
