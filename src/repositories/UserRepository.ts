import mongoose, { Types, type ClientSession, type FilterQuery } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { logger } from '@/lib/logger';
import User from '@/models/User';
import AdminMutationFence from '@/models/AdminMutationFence';
import type { PublicProfileUser, User as UserEntity } from '@/entities/User';
import {
  ActorNotActiveAdminError,
  AdminInvariantUnavailableError,
  AdminMutationConflictError,
  AdminMutationTargetNotFoundError,
  LastActiveAdminError,
  type AdminMutationInput,
  type AdminMutationResult,
} from '@/entities/AdminMutation';
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
import type { IRecentUserRepository } from '@/interfaces/repositories/IRecentUserRepository';
import {
  ACCOUNT_DISABLE_ACTIVE,
  ACCOUNT_DISABLE_DISABLED,
  ACTIVE_ACCOUNT_FILTER,
  type AccountDisableState,
} from '@/shared/constants/account-disable';
import { ACTIVE_ADMIN_FENCE_ID, ACTIVE_ADMIN_FILTER } from '@/shared/constants/admin-invariant';
import { buildEntitlementAccountProjection } from '@/repositories/pipelines/entitlement-account-projection';

const USER_ENTITY_PROJECTION = {
  _id: 1,
  email: 1,
  name: 1,
  displayName: 1,
  bio: 1,
  avatar: 1,
  role: 1,
  subscription: 1,
  createdAt: 1,
  disable: 1,
  disabledAt: 1,
  disabledBy: 1,
  isTestAccount: 1,
} as const;

interface ProjectedUserQueryOptions {
  limit?: number;
  skip?: number;
}

async function findProjectedUsers(
  match: Record<string, unknown>,
  options: ProjectedUserQueryOptions = {},
): Promise<UserPersistenceRecord[]> {
  return User.aggregate<UserPersistenceRecord>([
    { $match: match },
    { $sort: { createdAt: -1 } },
    ...(options.skip === undefined ? [] : [{ $skip: options.skip }]),
    ...(options.limit === undefined ? [] : [{ $limit: options.limit }]),
    ...buildEntitlementAccountProjection(),
    { $project: USER_ENTITY_PROJECTION },
  ]);
}

/**
 * Escape user-provided search so Mongo `$regex` treats it as a literal.
 * Shared extract of QuizAdminService.escapeRegexLiteral was deferred: GitNexus
 * upstream impact for that private helper resolved CRITICAL (name-collision
 * noise across many modules). Local helper keeps blast radius to admin user list.
 */
function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Canonical fence filter: singleton id, nonnegative integer revision, Date updatedAt. */
const CANONICAL_FENCE_FILTER = {
  _id: ACTIVE_ADMIN_FENCE_ID,
  updatedAt: { $type: 'date' as const },
  $expr: {
    $and: [
      { $isNumber: '$revision' },
      { $gte: ['$revision', 0] },
      { $eq: [{ $floor: '$revision' }, '$revision'] },
    ],
  },
};

function isTransactionUnsupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('transaction numbers are only allowed') ||
    message.includes('replica set') ||
    message.includes('transactions are not supported') ||
    (message.includes('transaction') && message.includes('not supported'))
  );
}

const MONGO_OPERATIONAL_ERROR_NAMES = new Set([
  'MongoError',
  'MongoExpiredSessionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerError',
  'MongoServerSelectionError',
  'MongoSystemError',
  'MongoTopologyClosedError',
]);

function isMongoOperationalError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isTransactionUnsupportedError(error) || MONGO_OPERATIONAL_ERROR_NAMES.has(error.name)) {
    return true;
  }

  const labelled = error as Error & { hasErrorLabel?: (label: string) => boolean };
  return Boolean(
    labelled.hasErrorLabel?.('TransientTransactionError') ||
    labelled.hasErrorLabel?.('UnknownTransactionCommitResult'),
  );
}

function rethrowDomainOrWrapAsUnavailable(error: unknown): never {
  if (
    error instanceof LastActiveAdminError ||
    error instanceof AdminInvariantUnavailableError ||
    error instanceof ActorNotActiveAdminError ||
    error instanceof AdminMutationTargetNotFoundError ||
    error instanceof AdminMutationConflictError
  ) {
    throw error;
  }
  if (isMongoOperationalError(error)) {
    throw new AdminInvariantUnavailableError(error);
  }
  throw error;
}

const ADMIN_TRANSACTION_OPTIONS = {
  readConcern: { level: 'snapshot' as const },
  writeConcern: { w: 'majority' as const, j: true },
  maxCommitTimeMS: 5_000,
};

export class UserRepository implements IUserRepository, IRecentUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await connectDB();
    const [record] = await findProjectedUsers(
      { _id: new Types.ObjectId(id), ...ACTIVE_ACCOUNT_FILTER },
      { limit: 1 },
    );
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findByIdIncludingDisabled(id: string): Promise<UserEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await connectDB();
    const [record] = await findProjectedUsers({ _id: new Types.ObjectId(id) }, { limit: 1 });
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    await connectDB();
    const [record] = await findProjectedUsers({ email, ...ACTIVE_ACCOUNT_FILTER }, { limit: 1 });
    return record ? UserPersistenceMapper.toEntity(record) : null;
  }

  async findPublicProfileById(id: string): Promise<PublicProfileUser | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await connectDB();
    const record = await User.findOne({ _id: id, ...ACTIVE_ACCOUNT_FILTER })
      .select('name displayName bio avatar createdAt')
      .lean<PublicProfileUserPersistenceRecord>();
    return record ? UserPersistenceMapper.toPublicProfile(record) : null;
  }

  async findRecent(limit: number): Promise<UserEntity[]> {
    await connectDB();
    const records = await findProjectedUsers({}, { limit });
    return records.map(UserPersistenceMapper.toEntity);
  }

  async findAll(options: UserFindOptions): Promise<PaginatedRepositoryResult<UserEntity>> {
    await connectDB();

    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<UserPersistenceRecord> = {};
    if (options.search) {
      query.email = { $regex: escapeRegexLiteral(options.search), $options: 'i' };
    }
    if (options.role) {
      query.role = options.role;
    }
    if (
      options.disable === ACCOUNT_DISABLE_ACTIVE ||
      options.disable === ACCOUNT_DISABLE_DISABLED
    ) {
      query.disable = options.disable;
    }

    const [records, totalItems] = await Promise.all([
      findProjectedUsers(query, { skip, limit }),
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

  async count(filter: CreatedAtCountFilter = {}): Promise<number> {
    await connectDB();
    return User.countDocuments(filter);
  }

  /**
   * Shared transactional primitive for admin role/status mutations.
   * Order is intentional and test-enforced: fence write-touch → actor/target re-read
   * → conditional active-admin count on set-reduction → mutation write.
   */
  async applyAdminMutation(mutation: AdminMutationInput): Promise<AdminMutationResult> {
    if (
      !Types.ObjectId.isValid(mutation.targetUserId) ||
      !Types.ObjectId.isValid(mutation.actor.id)
    ) {
      throw new AdminMutationTargetNotFoundError();
    }
    if (mutation.kind === 'disable') {
      if (
        mutation.disable !== ACCOUNT_DISABLE_ACTIVE &&
        mutation.disable !== ACCOUNT_DISABLE_DISABLED
      ) {
        throw new AdminMutationTargetNotFoundError();
      }
    } else if (mutation.role !== 'admin' && mutation.role !== 'user') {
      throw new AdminMutationTargetNotFoundError();
    }

    await connectDB();

    let session: ClientSession;
    try {
      session = await mongoose.startSession();
    } catch (error) {
      if (isMongoOperationalError(error)) {
        throw new AdminInvariantUnavailableError(error);
      }
      throw error;
    }

    try {
      // Return callback result: withTransaction may retry; never capture outer side effects.
      const result = await session.withTransaction(
        async () => this.executeAdminMutationInTransaction(mutation, session),
        ADMIN_TRANSACTION_OPTIONS,
      );
      return result;
    } catch (error) {
      return rethrowDomainOrWrapAsUnavailable(error);
    } finally {
      try {
        await session.endSession();
      } catch (cleanupError) {
        // Session cleanup is best-effort after the transaction outcome is known.
        // Never let cleanup replace a committed result or the primary failure.
        logger.error({ error: cleanupError }, 'Failed to end admin mutation MongoDB session');
      }
    }
  }

  /**
   * DB-only transaction body. No logger/cache/audit/response/outer capture.
   * Exported-via-class for unit ordering proofs with a injected session mock.
   */
  private async executeAdminMutationInTransaction(
    mutation: AdminMutationInput,
    session: ClientSession,
  ): Promise<AdminMutationResult> {
    // 1) WRITE-TOUCH fence FIRST — missing/malformed fence fails closed (no upsert).
    const fenceTouch = await AdminMutationFence.findOneAndUpdate(
      CANONICAL_FENCE_FILTER,
      {
        $inc: { revision: 1 },
        $set: { updatedAt: new Date() },
      },
      { new: true, session },
    ).lean<{ _id: string; revision: number; updatedAt: Date }>();

    if (
      !fenceTouch ||
      !Number.isInteger(fenceTouch.revision) ||
      fenceTouch.revision < 0 ||
      !(fenceTouch.updatedAt instanceof Date)
    ) {
      throw new AdminInvariantUnavailableError();
    }

    // 2) Re-read actor: must still match id + email + role admin + disable 0.
    const actorRecord = await User.findOne({
      _id: new Types.ObjectId(mutation.actor.id),
      email: mutation.actor.email,
      ...ACTIVE_ADMIN_FILTER,
    })
      .select(USER_ENTITY_PROJECTION)
      .session(session)
      .lean<UserPersistenceRecord>();

    if (!actorRecord) {
      throw new ActorNotActiveAdminError();
    }

    // 3) Re-read target (admin-inclusive).
    const targetRecord = await User.findById(mutation.targetUserId)
      .select(USER_ENTITY_PROJECTION)
      .session(session)
      .lean<UserPersistenceRecord>();

    if (!targetRecord) {
      throw new AdminMutationTargetNotFoundError();
    }

    const targetIsActiveAdmin =
      targetRecord.role === 'admin' && targetRecord.disable === ACCOUNT_DISABLE_ACTIVE;

    if (mutation.kind === 'role') {
      const wouldReduceActiveAdminSet = targetIsActiveAdmin && mutation.role === 'user';
      if (wouldReduceActiveAdminSet) {
        const activeAdminCount = await User.countDocuments({ ...ACTIVE_ADMIN_FILTER }, { session });
        if (activeAdminCount <= 1) {
          throw new LastActiveAdminError();
        }
      }

      if (targetRecord.role === mutation.role) {
        // No-op: fence was touched; authVersion not incremented.
        return {
          kind: 'role',
          user: UserPersistenceMapper.toEntity(targetRecord),
          changed: false,
          role: mutation.role,
        };
      }

      const updated = await User.findOneAndUpdate(
        {
          _id: targetRecord._id,
          role: targetRecord.role,
        },
        {
          $set: { role: mutation.role },
          $inc: { authVersion: 1 },
        },
        { new: true, session },
      )
        .select(USER_ENTITY_PROJECTION)
        .lean<UserPersistenceRecord>();

      if (!updated) {
        throw new AdminMutationConflictError();
      }

      return {
        kind: 'role',
        user: UserPersistenceMapper.toEntity(updated),
        changed: true,
        role: mutation.role,
      };
    }

    // disable / restore path
    const wouldReduceActiveAdminSet =
      targetIsActiveAdmin && mutation.disable === ACCOUNT_DISABLE_DISABLED;
    if (wouldReduceActiveAdminSet) {
      const activeAdminCount = await User.countDocuments({ ...ACTIVE_ADMIN_FILTER }, { session });
      if (activeAdminCount <= 1) {
        throw new LastActiveAdminError();
      }
    }

    if (targetRecord.disable === mutation.disable) {
      // No-op: fence was touched; authVersion not incremented.
      return {
        kind: 'disable',
        user: UserPersistenceMapper.toEntity(targetRecord),
        changed: false,
        disable: mutation.disable,
      };
    }

    const opposite: AccountDisableState =
      mutation.disable === ACCOUNT_DISABLE_DISABLED
        ? ACCOUNT_DISABLE_ACTIVE
        : ACCOUNT_DISABLE_DISABLED;

    const setFields =
      mutation.disable === ACCOUNT_DISABLE_DISABLED
        ? {
            disable: ACCOUNT_DISABLE_DISABLED,
            disabledAt: mutation.now,
            disabledBy: new Types.ObjectId(mutation.actor.id),
          }
        : {
            disable: ACCOUNT_DISABLE_ACTIVE,
            disabledAt: null,
            disabledBy: null,
          };

    // Real disable transitions revoke pending security tokens so a later restore
    // cannot revive password-reset / email-verification issuance. Restore does
    // not recreate tokens.
    const updateDoc =
      mutation.disable === ACCOUNT_DISABLE_DISABLED
        ? {
            $set: setFields,
            $inc: { authVersion: 1 },
            $unset: {
              passwordResetTokenHash: 1,
              passwordResetExpires: 1,
              emailVerificationTokenHash: 1,
              emailVerificationExpires: 1,
            },
          }
        : {
            $set: setFields,
            $inc: { authVersion: 1 },
          };

    const transitioned = await User.findOneAndUpdate(
      { _id: targetRecord._id, disable: opposite },
      updateDoc,
      { new: true, session },
    )
      .select(USER_ENTITY_PROJECTION)
      .lean<UserPersistenceRecord>();

    if (!transitioned) {
      throw new AdminMutationConflictError();
    }

    return {
      kind: 'disable',
      user: UserPersistenceMapper.toEntity(transitioned),
      changed: true,
      disable: mutation.disable,
    };
  }
}
