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
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import { buildPaginationMeta } from '@/lib/pagination';
import mongoose, { Types, type FilterQuery } from 'mongoose';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizPersistenceRecord } from '@/repositories/types/QuizPersistence';
import { serializeId } from '@/lib/mongo-id';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';
import { deleteQuizDependents } from '@/repositories/helpers/deleteQuizDependents';

export class QuizRepository implements IQuizRepository {
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
    await connectDB();
    const record = await QuizModel.findOne({ slug })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async findSummaryBySlug(slug: string): Promise<Quiz | null> {
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
      {
        $project: {
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
          questions: { $literal: [] },
          questionCount: { $size: { $ifNull: ['$questions', []] } },
          isPrivate: 1,
          pdfUrl: 1,
          tags: 1,
          sourceDraftId: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);
    return record ? QuizPersistenceMapper.toEntity(record) : null;
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
    const record = await QuizModel.findByIdAndUpdate(id, quizData, { new: true })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    const session = await mongoose.startSession();
    let deleted = false;

    try {
      await session.withTransaction(async () => {
        const quiz = await QuizModel.findById(id)
          .select('_id slug')
          .session(session)
          .lean<{ _id: Types.ObjectId; slug: string } | null>();
        if (!quiz) return;

        await deleteQuizDependents([{ id: quiz._id, slug: quiz.slug }], session);

        const result = await QuizModel.deleteOne({ _id: quiz._id }).session(session);
        deleted = result.deletedCount === 1;
      });

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

    if (options.compact) {
      const normalizedFilter: FilterQuery<QuizPersistenceRecord> = { ...filter };

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

      const [records, total] = await Promise.all([
        QuizModel.aggregate<QuizPersistenceRecord>([
          { $match: normalizedFilter },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'authorDoc',
            },
          },
          {
            $unwind: {
              path: '$authorDoc',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              slug: 1,
              isPrivate: 1,
              author: {
                _id: { $ifNull: ['$authorDoc._id', '$author'] },
                email: '$authorDoc.email',
                name: '$authorDoc.name',
                displayName: '$authorDoc.displayName',
                avatar: '$authorDoc.avatar',
              },
              createdAt: 1,
              updatedAt: 1,
              folder: 1,
              questionCount: { $size: { $ifNull: ['$questions', []] } },
              questions: { $literal: [] },
            },
          },
        ]),
        QuizModel.countDocuments(normalizedFilter),
      ]);

      return {
        items: records.map(QuizPersistenceMapper.toEntity),
        pagination: buildPaginationMeta(page, limit, total),
      };
    }

    const persistenceFilter: FilterQuery<QuizPersistenceRecord> = filter;
    let query = QuizModel.find(persistenceFilter);

    if (options.populate?.includes('author')) {
      query = query.populate('author', 'email name displayName avatar');
    }
    const [records, total] = await Promise.all([
      query.sort(sort).skip(skip).limit(limit).lean<QuizPersistenceRecord[]>(),
      QuizModel.countDocuments(persistenceFilter),
    ]);

    return {
      items: records.map(QuizPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async findForPlay(slug: string): Promise<Quiz | null> {
    await connectDB();
    const record = await QuizModel.findOne({ slug })
      .populate('author', 'email name displayName avatar')
      .lean<QuizPersistenceRecord>();
    return record ? QuizPersistenceMapper.toEntity(record) : null;
  }

  async findUserQuizzes(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Quiz>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<QuizPersistenceRecord> = {
      author: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
    };
    const [records, total] = await Promise.all([
      QuizModel.aggregate<QuizPersistenceRecord>([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            slug: 1,
            author: 1,
            folder: 1,
            questions: { $literal: [] },
            questionCount: { $size: { $ifNull: ['$questions', []] } },
            isPrivate: 1,
            pdfUrl: 1,
            tags: 1,
            sourceDraftId: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]),
      QuizModel.countDocuments(filter),
    ]);

    return {
      items: records.map(QuizPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async findPublicByAuthor(userId: string): Promise<Quiz[]> {
    await connectDB();
    const records = await QuizModel.aggregate<QuizPersistenceRecord>([
      { $match: { author: new Types.ObjectId(userId), isPrivate: false } },
      { $sort: { createdAt: -1 } },
      {
        $project: {
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
        },
      },
    ]);
    return records.map(QuizPersistenceMapper.toEntity);
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

  async findTopCreators(limit: number): Promise<QuizCreatorStatRecord[]> {
    await connectDB();

    const records = await QuizModel.aggregate<{
      _id: Types.ObjectId;
      email: string;
      role: 'admin' | 'user';
      joinedAt: Date;
      quizCount: number;
      totalQuestions: number;
    }>([
      {
        $group: {
          _id: '$author',
          quizCount: { $sum: 1 },
          totalQuestions: { $sum: { $size: { $ifNull: ['$questions', []] } } },
        },
      },
      { $sort: { quizCount: -1, totalQuestions: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          email: '$author.email',
          role: '$author.role',
          joinedAt: '$author.createdAt',
          quizCount: 1,
          totalQuestions: 1,
        },
      },
    ]);

    return records.map((record) => {
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
    });
  }
}
