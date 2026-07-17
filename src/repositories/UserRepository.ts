import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import AuditLog from '@/models/AuditLog';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import Folder from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import Report from '@/models/Report';
import Subscription from '@/models/Subscription';
import User from '@/models/User';
import UserProgress from '@/models/UserProgress';
import type {
  PublicProfileUser,
  User as UserEntity,
  UserSubscriptionSnapshot,
} from '@/entities/User';
import { buildPaginationMeta } from '@/lib/pagination';
import {
  IUserRepository,
  type UserFindOptions,
  type UserRoleCount,
} from '@/interfaces/repositories/IUserRepository';
import type {
  CountBuckets,
  CountBucketThresholds,
  CreatedAtCountFilter,
  PaginatedRepositoryResult,
} from '@/interfaces/repositories/types';
import mongoose, { Types, type FilterQuery } from 'mongoose';
import { buildMongoOrFilter } from '@/lib/mongoose-query';
import {
  toUserSubscription,
  UserPersistenceMapper,
} from '@/repositories/mappers/UserPersistenceMapper';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
  UserSubscriptionProjection,
} from '@/repositories/types/UserPersistence';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';
import { deleteQuizDependents } from '@/repositories/helpers/deleteQuizDependents';
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';

const USER_ENTITY_PROJECTION = '_id email name displayName bio avatar role subscription createdAt';

export class UserRepository implements IUserRepository, IRecentUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    await connectDB();
    const record = await User.findById(id)
      .select(USER_ENTITY_PROJECTION)
      .lean<UserPersistenceRecord>();
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    await connectDB();
    const record = await User.findOne({ email })
      .select(USER_ENTITY_PROJECTION)
      .lean<UserPersistenceRecord>();
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findSubscriptionById(id: string): Promise<UserSubscriptionSnapshot | null> {
    await connectDB();
    const record = await User.findById(id)
      .select('subscription')
      .lean<UserSubscriptionProjection>();
    return record?.subscription ? toUserSubscription(record.subscription) : null;
  }

  async findPublicProfileById(id: string): Promise<PublicProfileUser | null> {
    await connectDB();
    const record = await User.findById(id)
      .select('email name displayName bio avatar createdAt')
      .lean<PublicProfileUserPersistenceRecord>();
    return record ? UserPersistenceMapper.toPublicProfile(record) : null;
  }

  async findRecent(limit: number): Promise<UserEntity[]> {
    await connectDB();
    const records = await User.find({})
      .select(USER_ENTITY_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<UserPersistenceRecord[]>();
    return records.map(UserPersistenceMapper.toEntity);
  }

  async findAll(options: UserFindOptions): Promise<PaginatedRepositoryResult<UserEntity>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Build query
    const query: FilterQuery<UserPersistenceRecord> = {};
    if (options.search) {
      query.email = { $regex: options.search, $options: 'i' };
    }
    if (options.role) {
      query.role = options.role;
    }

    const [records, totalItems] = await Promise.all([
      User.find(query)
        .select(USER_ENTITY_PROJECTION)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<UserPersistenceRecord[]>(),
      User.countDocuments(query),
    ]);

    return {
      items: records.map(UserPersistenceMapper.toEntity),
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  async countByRole(): Promise<UserRoleCount[]> {
    await connectDB();
    return await User.aggregate<UserRoleCount>([
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
  }

  async countByCreatedAtBuckets(thresholds: CountBucketThresholds): Promise<CountBuckets> {
    await connectDB();
    const records = await User.aggregate<CountBucketAggregateRecord>(
      buildCountBucketsPipeline('createdAt', thresholds),
    );
    return resolveCountBuckets(records);
  }

  async updateRole(id: string, role: UserEntity['role']): Promise<UserEntity | null> {
    await connectDB();
    const record = await User.findByIdAndUpdate(
      id,
      { $set: { role } },
      {
        new: true,
      },
    )
      .select(USER_ENTITY_PROJECTION)
      .lean<UserPersistenceRecord>();
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async delete(id: string): Promise<boolean> {
    await connectDB();
    if (!Types.ObjectId.isValid(id)) return false;

    const userObjectId = new Types.ObjectId(id);
    const session = await mongoose.startSession();
    let deleted = false;

    try {
      await session.withTransaction(async () => {
        const user = await User.findById(userObjectId)
          .select('_id email')
          .session(session)
          .lean<{ _id: Types.ObjectId; email: string } | null>();
        if (!user) return;

        const authoredQuizzes = await Quiz.find({ author: userObjectId })
          .select('_id slug')
          .session(session)
          .lean<Array<{ _id: Types.ObjectId; slug: string }>>();
        const authoredQuizIds = authoredQuizzes.map((quiz) => quiz._id);
        const normalizedEmail = user.email.toLowerCase();

        await Attempt.deleteMany(
          buildMongoOrFilter([{ user: userObjectId }, { guestEmail: normalizedEmail }]),
        ).session(session);

        // Billing retention: hard-delete only incomplete pending rows. Completed /
        // failed / cancelled / expired history is scrubbed of direct identifiers
        // but kept for financial audit (user ObjectId retained; email pseudonymized).
        const subscriptionOwnerFilter = buildMongoOrFilter([
          { user: userObjectId },
          { userEmail: normalizedEmail },
        ]);
        await Subscription.deleteMany({
          ...subscriptionOwnerFilter,
          status: 'pending',
        }).session(session);
        await Subscription.updateMany(
          {
            ...subscriptionOwnerFilter,
            status: { $in: ['completed', 'failed', 'cancelled', 'expired'] },
          },
          {
            $set: {
              userEmail: `deleted+${id}@retained.local`,
              isActive: false,
            },
            $unset: { payosPaymentUrl: 1 },
          },
        ).session(session);

        await Bookmark.deleteMany(
          buildMongoOrFilter([{ userId: id }, { userEmail: normalizedEmail }]),
        ).session(session);
        await QuestionProgress.deleteMany({ userId: id }).session(session);
        await UserProgress.deleteMany({ userId: id }).session(session);
        await QuizProgress.deleteMany({ userId: userObjectId }).session(session);
        await FolderQuiz.deleteMany({ owner: userObjectId }).session(session);
        await Folder.deleteMany({ owner: userObjectId }).session(session);
        await Discussion.updateMany(
          { 'comments.author': userObjectId },
          { $pull: { comments: { author: userObjectId } } },
        ).session(session);
        await Report.deleteMany({ reporterEmail: normalizedEmail }).session(session);
        await deleteQuizDependents(
          authoredQuizzes.map((quiz) => ({ id: quiz._id, slug: quiz.slug })),
          session,
        );
        if (authoredQuizIds.length > 0) {
          await Quiz.deleteMany({ _id: { $in: authoredQuizIds } }).session(session);
        }
        await AuditLog.updateMany({ userId: userObjectId }, { $set: { userId: null } }).session(
          session,
        );

        const result = await User.deleteOne({ _id: userObjectId }).session(session);
        deleted = result.deletedCount === 1;
      });

      return deleted;
    } finally {
      await session.endSession();
    }
  }

  async count(filter: CreatedAtCountFilter = {}): Promise<number> {
    await connectDB();
    return User.countDocuments(filter);
  }
}
