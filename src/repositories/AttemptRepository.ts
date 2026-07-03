import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import { buildPaginationMeta } from '@/lib/pagination';
import type { Attempt } from '@/entities/Attempt';
import type {
  AttemptCountFilter,
  AttemptOwnerIdentity,
  CreateAttemptData,
  IAttemptRepository,
} from '@/interfaces/repositories/IAttemptRepository';
import type {
  CountBuckets,
  CountBucketThresholds,
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';
import { AttemptPersistenceMapper } from '@/repositories/mappers/AttemptPersistenceMapper';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';
import type { AttemptPersistenceRecord } from '@/repositories/types/AttemptPersistence';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';

const attemptListQuizFields = 'title slug description';
const attemptDetailQuizFields = 'title slug description questions';

export class AttemptRepository implements IAttemptRepository {
  async findByUser(
    userId: string,
    options: RepositoryPaginationOptions,
  ): Promise<PaginatedRepositoryResult<Attempt>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [records, totalItems] = await Promise.all([
      AttemptModel.find({ user: userId })
        .populate('quiz', attemptListQuizFields)
        .sort({ takenAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<AttemptPersistenceRecord[]>(),
      AttemptModel.countDocuments({ user: userId }),
    ]);

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

  async findRecentActivity(limit: number): Promise<Attempt[]> {
    await connectDB();
    const records = await AttemptModel.find()
      .populate('user', 'email')
      .populate('quiz', 'title slug')
      .sort({ takenAt: -1 })
      .limit(limit)
      .lean<AttemptPersistenceRecord[]>();
    return records.map(AttemptPersistenceMapper.toEntity);
  }

  async findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null> {
    await connectDB();
    const identityFilter = owner.userId ? { user: owner.userId } : { guestEmail: owner.guestEmail };
    const record = await AttemptModel.findOne({
      _id: attemptId,
      ...identityFilter,
    })
      .populate('quiz', attemptDetailQuizFields)
      .lean<AttemptPersistenceRecord>();
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
}
