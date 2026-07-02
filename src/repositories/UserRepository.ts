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
import type { PublicProfileUser, User as UserEntity } from '@/entities/User';
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
import { UserPersistenceMapper } from '@/repositories/mappers/UserPersistenceMapper';
import type {
  PublicProfileUserPersistenceRecord,
  UserPersistenceRecord,
} from '@/repositories/types/UserPersistence';
import {
  buildCountBucketsPipeline,
  resolveCountBuckets,
  type CountBucketAggregateRecord,
} from '@/lib/mongoose-count-buckets';

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    await connectDB();
    const record = await User.findById(id).lean<UserPersistenceRecord>();
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    await connectDB();
    const record = await User.findOne({ email }).lean<UserPersistenceRecord>();
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findPublicProfileById(id: string): Promise<PublicProfileUser | null> {
    await connectDB();
    const record = await User.findById(id)
      .select('email name displayName bio avatar createdAt')
      .lean<PublicProfileUserPersistenceRecord>();
    return record ? UserPersistenceMapper.toPublicProfile(record) : null;
  }

  async findAll(options?: UserFindOptions): Promise<PaginatedRepositoryResult<UserEntity>> {
    await connectDB();

    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: FilterQuery<UserPersistenceRecord> = {};
    if (options?.search) {
      query.email = { $regex: options.search, $options: 'i' };
    }
    if (options?.role) {
      query.role = options.role;
    }

    const [records, totalItems] = await Promise.all([
      User.find(query)
        .select('-password')
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
    ).lean<UserPersistenceRecord>();
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
        const authoredQuizSlugs = authoredQuizzes.map((quiz) => quiz.slug);
        const authoredQuizIdStrings = authoredQuizIds.map(String);
        const normalizedEmail = user.email.toLowerCase();

        await Promise.all([
          Attempt.deleteMany(
            buildMongoOrFilter([
              { user: userObjectId },
              authoredQuizIds.length > 0 ? { quiz: { $in: authoredQuizIds } } : null,
            ]),
          ).session(session),
          Subscription.deleteMany(
            buildMongoOrFilter([{ user: userObjectId }, { userEmail: normalizedEmail }]),
          ).session(session),
          Bookmark.deleteMany(
            buildMongoOrFilter([
              { userId: id },
              { userEmail: normalizedEmail },
              authoredQuizSlugs.length > 0 ? { 'quiz.slug': { $in: authoredQuizSlugs } } : null,
            ]),
          ).session(session),
          QuestionProgress.deleteMany(
            buildMongoOrFilter([
              { userId: id },
              authoredQuizSlugs.length > 0 ? { quizSlug: { $in: authoredQuizSlugs } } : null,
            ]),
          ).session(session),
          UserProgress.deleteMany({ userId: id }).session(session),
          QuizProgress.deleteMany(
            buildMongoOrFilter([
              { userId: userObjectId },
              authoredQuizIds.length > 0 ? { quiz: { $in: authoredQuizIds } } : null,
            ]),
          ).session(session),
          FolderQuiz.deleteMany(
            buildMongoOrFilter([
              { owner: userObjectId },
              authoredQuizIds.length > 0 ? { quiz: { $in: authoredQuizIds } } : null,
            ]),
          ).session(session),
          Folder.deleteMany({ owner: userObjectId }).session(session),
          Discussion.updateMany(
            { 'comments.author': userObjectId },
            { $pull: { comments: { author: userObjectId } } },
          ).session(session),
          authoredQuizIds.length > 0
            ? Discussion.deleteMany({ quiz: { $in: authoredQuizIds } }).session(session)
            : Promise.resolve(),
          Report.deleteMany(
            buildMongoOrFilter([
              { reporterEmail: normalizedEmail },
              authoredQuizIdStrings.length > 0 ? { quizId: { $in: authoredQuizIdStrings } } : null,
            ]),
          ).session(session),
          authoredQuizIds.length > 0
            ? Quiz.deleteMany({ _id: { $in: authoredQuizIds } }).session(session)
            : Promise.resolve(),
          AuditLog.updateMany({ userId: userObjectId }, { $set: { userId: null } }).session(
            session,
          ),
        ]);

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
