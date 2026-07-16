import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import { buildPaginationMeta } from '@/lib/pagination';
import type { Attempt } from '@/entities/Attempt';
import type {
  AttemptCountFilter,
  AttemptOwnerIdentity,
  AttemptScoreStats,
  CreateAttemptData,
  IAttemptRepository,
  RecentAttemptActivity,
} from '@/interfaces/repositories/IAttemptRepository';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import { AttemptPersistenceMapper } from '@/repositories/mappers/AttemptPersistenceMapper';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';
import type {
  AttemptPersistenceRecord,
  RecentAttemptActivityPersistenceRecord,
} from '@/repositories/types/AttemptPersistence';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';
import { Types } from 'mongoose';
import { serializeId } from '@/lib/mongo-id';
import { buildRecentAttemptActivityPipeline } from '@/repositories/pipelines/recent-attempt-activity.mjs';
import {
  buildAttemptDetailPipeline,
  buildUserAttemptListPipeline,
} from '@/repositories/pipelines/attempt-read.mjs';

type AttemptListFacetMeta = {
  totalItems: number;
};

type AttemptListFacetResult = {
  items: AttemptPersistenceRecord[];
  meta: AttemptListFacetMeta[];
};

function toObjectIdIfValid(value: string): string | Types.ObjectId {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;
}

export class AttemptRepository implements IAttemptRepository {
  async findByUser(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Attempt>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [result] = await AttemptModel.aggregate<AttemptListFacetResult>(
      buildUserAttemptListPipeline(toObjectIdIfValid(userId), skip, limit),
    );
    const records = result?.items ?? [];
    const totalItems = result?.meta[0]?.totalItems ?? 0;

    return {
      items: records.map(AttemptPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async create(data: CreateAttemptData): Promise<Attempt> {
    await connectDB();
    const identity = data.userId ? { user: data.userId } : { guestEmail: data.guestEmail };
    const document = await AttemptModel.create({
      ...identity,
      quiz: data.quizId,
      quizSnapshot: {
        ...data.quizSnapshot,
        questions: data.quizSnapshot.questions.map(({ id, ...question }) => ({
          _id: id,
          ...question,
        })),
      },
      answers: data.answers.map(AnswerPersistenceMapper.toPersistence),
      score: data.score,
      totalQuestions: data.totalQuestions,
      takenAt: data.takenAt,
    });
    const record: AttemptPersistenceRecord = document.toObject();
    return AttemptPersistenceMapper.toEntity(record);
  }

  async countByUser(userId: string): Promise<number> {
    await connectDB();
    return AttemptModel.countDocuments({ user: userId });
  }

  async countByQuiz(quizId: string): Promise<number> {
    await connectDB();
    return AttemptModel.countDocuments({ quiz: quizId });
  }

  async findRecentActivity(limit: number): Promise<RecentAttemptActivity[]> {
    await connectDB();
    const records = await AttemptModel.aggregate<RecentAttemptActivityPersistenceRecord>(
      buildRecentAttemptActivityPipeline(limit),
    );
    return records.map((record) => ({
      id: serializeId(record._id, 'recentAttempt._id'),
      ...(record.userEmail === undefined ? {} : { userEmail: record.userEmail }),
      ...(record.guestEmail === undefined ? {} : { guestEmail: record.guestEmail }),
      ...(record.quizTitle === undefined ? {} : { quizTitle: record.quizTitle }),
      score: record.score,
      answeredQuestions: record.answeredQuestions,
      takenAt: record.takenAt,
    }));
  }

  async findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null> {
    await connectDB();
    const identityFilter = owner.userId
      ? { user: toObjectIdIfValid(owner.userId) }
      : { guestEmail: owner.guestEmail };
    const [record] = await AttemptModel.aggregate<AttemptPersistenceRecord>(
      buildAttemptDetailPipeline(toObjectIdIfValid(attemptId), identityFilter),
    );
    return record ? AttemptPersistenceMapper.toEntity(record) : null;
  }

  async count(filter: AttemptCountFilter = {}): Promise<number> {
    await connectDB();
    return AttemptModel.countDocuments(filter);
  }

  async countByTakenAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets> {
    await connectDB();
    const records = await AttemptModel.aggregate<CountBucketAggregateRecord>(
      buildCountBucketsPipeline('takenAt', thresholds),
    );
    return resolveCountBuckets(records);
  }

  async scoreStats(): Promise<AttemptScoreStats> {
    await connectDB();
    const [record] = await AttemptModel.aggregate<AttemptScoreStats>([
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$score' },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' },
        },
      },
      { $project: { _id: 0, averageScore: 1, highestScore: 1, lowestScore: 1 } },
    ]);
    return record ?? { averageScore: 0, highestScore: 0, lowestScore: 0 };
  }
}
