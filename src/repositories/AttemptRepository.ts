import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import { buildPaginationMeta } from '@/lib/pagination';
import type { Attempt } from '@/entities/Attempt';
import type {
  AttemptCountFilter,
  AttemptHistoryPage,
  AttemptHistoryQuery,
  AttemptHistorySummary,
  AttemptOwnerIdentity,
  AttemptScoreStats,
  IAttemptRepository,
  RecentAttemptActivity,
} from '@/interfaces/repositories/IAttemptRepository';
import type { CountBuckets, CountBucketThresholds } from '@/interfaces/repositories/types';
import { ATTEMPT_PASS_MARK } from '@/shared/constants/attempt-result';
import { AttemptPersistenceMapper } from '@/repositories/mappers/AttemptPersistenceMapper';
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
import { objectIdSchema } from '@/lib/validation/common';
import { buildRecentAttemptActivityPipeline } from '@/repositories/pipelines/recent-attempt-activity.mjs';
import {
  buildAttemptDetailPipeline,
  buildUserAttemptListPipeline,
} from '@/repositories/pipelines/attempt-read.mjs';

type AttemptListFacetMeta = {
  totalItems: number;
};

type AttemptListFacetSummary = {
  totalAttempts: number;
  averageScore: number | null;
  needsWorkCount: number;
};

type AttemptListFacetResult = {
  items: AttemptPersistenceRecord[];
  meta: AttemptListFacetMeta[];
  summary?: AttemptListFacetSummary[];
};

function toHistorySummary(record: AttemptListFacetSummary | undefined): AttemptHistorySummary {
  if (!record || record.totalAttempts === 0) {
    return { totalAttempts: 0, averageScore: null, needsWorkCount: 0 };
  }
  return {
    totalAttempts: record.totalAttempts,
    averageScore: record.averageScore === null ? null : Math.round(record.averageScore * 10) / 10,
    needsWorkCount: record.needsWorkCount,
  };
}

/** Strict 24-hex ObjectId; invalid values fail before any Mongo query. */
function toStrictObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(objectIdSchema.parse(value));
}

type AttemptOwnerFilter =
  | { user: Types.ObjectId }
  | { guestClaimTokenHash: string; user: null }
  | { guestEmail: string | undefined };

function toAttemptOwnerFilter(owner: AttemptOwnerIdentity): AttemptOwnerFilter {
  if (owner.userId) return { user: toStrictObjectId(owner.userId) };
  // Only an unclaimed guest attempt: a claimed one has a user (and no hash).
  if (owner.guestClaimTokenHash)
    return { guestClaimTokenHash: owner.guestClaimTokenHash, user: null };
  return { guestEmail: owner.guestEmail };
}

export class AttemptRepository implements IAttemptRepository {
  async findByUser(userId: string, options: AttemptHistoryQuery): Promise<AttemptHistoryPage> {
    const userObjectId = toStrictObjectId(userId);
    await connectDB();

    const { page, limit, result: resultFilter } = options;
    const skip = (page - 1) * limit;

    const [result] = await AttemptModel.aggregate<AttemptListFacetResult>(
      buildUserAttemptListPipeline(userObjectId, skip, limit, {
        ...(resultFilter === undefined ? {} : { result: resultFilter }),
        passMark: ATTEMPT_PASS_MARK,
      }),
    );
    const records = result?.items ?? [];
    const totalItems = result?.meta[0]?.totalItems ?? 0;

    return {
      items: records.map(AttemptPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
      summary: toHistorySummary(result?.summary?.[0]),
    };
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
      ...(record.isClaimTokenGuest === true ? { isClaimTokenGuest: true } : {}),
      ...(record.quizTitle === undefined ? {} : { quizTitle: record.quizTitle }),
      score: record.score,
      answeredQuestions: record.answeredQuestions,
      takenAt: record.takenAt,
    }));
  }

  async findByIdWithQuiz(attemptId: string, owner: AttemptOwnerIdentity): Promise<Attempt | null> {
    const attemptObjectId = toStrictObjectId(attemptId);
    const identityFilter = toAttemptOwnerFilter(owner);
    await connectDB();
    const [record] = await AttemptModel.aggregate<AttemptPersistenceRecord>(
      buildAttemptDetailPipeline(attemptObjectId, identityFilter),
    );
    return record ? AttemptPersistenceMapper.toEntity(record) : null;
  }

  /** Which of `slugs` the owner has an attempt for; scans only that owner's attempts. */
  async findAttemptedQuizSlugs(owner: AttemptOwnerIdentity, slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const identityFilter = toAttemptOwnerFilter(owner);
    await connectDB();
    const attempted: unknown[] = await AttemptModel.distinct('quizSnapshot.slug', {
      ...identityFilter,
      'quizSnapshot.slug': { $in: slugs },
    });
    return attempted.filter((slug): slug is string => typeof slug === 'string');
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
