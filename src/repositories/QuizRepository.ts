import connectDB from '@/lib/mongoose';
import QuizModel from '@/models/Quiz';
import type { Quiz } from '@/entities/Quiz';
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
import { deleteOwnedPdfUrlsBestEffort } from '@/lib/s3';

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
  projection: PipelineStage.Project['$project'];
  skip: number;
}

interface PaginatedQuizListQueryOptions extends RepositoryPaginationOptions {
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
  isPrivate: 1,
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

const QUIZ_WITH_AUTHOR_PROJECTION = {
  _id: 1,
  title: 1,
  description: 1,
  slug: 1,
  author: {
    _id: { $ifNull: [{ $first: '$authorDoc._id' }, '$author'] },
    email: { $first: '$authorDoc.email' },
    name: { $first: '$authorDoc.name' },
    displayName: { $first: '$authorDoc.displayName' },
    avatar: { $first: '$authorDoc.avatar' },
  },
  folder: 1,
  isPrivate: 1,
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

function buildPaginatedQuizListPipeline(
  filter: FilterQuery<QuizPersistenceRecord>,
  options: PaginatedQuizListPipelineOptions,
): PipelineStage[] {
  return [
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
  const { page, limit, projection } = options;
  const [result] = await QuizModel.aggregate<QuizListAggregateResult>(
    buildPaginatedQuizListPipeline(filter, {
      limit,
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
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async findAccessById(id: string): Promise<Pick<Quiz, 'id' | 'author' | 'isPrivate'> | null> {
    await connectDB();
    const record = await QuizModel.findById(id)
      .select('_id author isPrivate')
      .lean<Pick<QuizPersistenceRecord, '_id' | 'author' | 'isPrivate'>>();

    return record
      ? {
          id: serializeId(record._id, 'quiz._id'),
          author: serializeId(record.author, 'quiz.author'),
          isPrivate: record.isPrivate,
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

  async findBySourceDraftId(sourceDraftId: string): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findOne({ sourceDraftId })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async create(quizData: CreateQuizData): Promise<Quiz> {
    await connectDB();
    const document = new QuizModel(quizData);
    await document.save();
    const record: QuizPersistenceRecord = document.toObject();
    return QuizPersistenceMapper.toEntity(record);
  }

  async update(id: string, quizData: UpdateQuizData): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findByIdAndUpdate(id, quizData, {
      new: true,
      runValidators: true,
    })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    let deleted = false;
    let pdfUrl: string | undefined;

    try {
      await session.withTransaction(async () => {
        const quiz = await QuizModel.findById(id)
          .select('_id slug pdfUrl')
          .session(session)
          .lean<{ _id: Types.ObjectId; slug: string; pdfUrl?: string } | null>();
        if (!quiz) return;

        pdfUrl = quiz.pdfUrl;
        await deleteQuizDependents([{ id: quiz._id, slug: quiz.slug }], session);

        const result = await QuizModel.deleteOne({ _id: quiz._id }).session(session);
        deleted = result.deletedCount === 1;
      });

      // External object storage cleanup is best-effort and runs only after a
      // successful Mongo transaction commit (never inside the transaction).
      if (deleted) {
        await deleteOwnedPdfUrlsBestEffort([pdfUrl]);
      }

      return deleted;
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
        '_id title description slug author folder questions isPrivate pdfUrl tags sourceDraftId createdAt updatedAt',
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
      projection: USER_QUIZ_LIST_PROJECTION,
    });
  }

  async findPublicByAuthor(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>> {
    await connectDB();
    const filter = { author: new Types.ObjectId(userId), isPrivate: false };
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

    return {
      items: records.map((record) => {
        if (!record.email || !record.role || !record.joinedAt) {
          throw new TypeError(`Quiz creator ${String(record._id)} could not be resolved`);
        }

        return {
          id: String(record._id),
          email: record.email,
          role: record.role,
          joinedAt: record.joinedAt,
          quizCount: record.quizCount,
          totalQuestions: record.totalQuestions,
        };
      }),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}
