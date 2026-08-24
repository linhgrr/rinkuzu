import { randomBytes } from 'node:crypto';
import mongoose, { Types, type ClientSession, type FilterQuery } from 'mongoose';
import connectDB from '@/lib/mongoose';
import User from '@/models/User';
import PremiumQuizSubmissionModel from '@/models/PremiumQuizSubmission';
import PremiumReviewJob from '@/models/PremiumReviewJob';
import CreditWalletModel from '@/models/CreditWallet';
import CreditLedgerModel from '@/models/CreditLedger';
import PremiumQuizAccessGrant from '@/models/PremiumQuizAccessGrant';
import PremiumPlaySessionModel from '@/models/PremiumPlaySession';
import type { PremiumQuizSubmissionDocument } from '@/models/PremiumQuizSubmission';
import type {
  CreatePremiumSessionData,
  CreatePremiumSubmissionData,
  AdminCreditGrantData,
  AdminCreditGrantResult,
  CreditLedgerListResult,
  IPremiumQuizRepository,
  PremiumCatalogListOptions,
  PremiumCatalogListResult,
  PremiumDecisionData,
  PremiumDecisionResult,
  PremiumReviewJobData,
  PremiumReviewJobRecord,
  PremiumSubmissionListOptions,
  PremiumSubmissionListResult,
  PremiumUnlockData,
  PremiumUnlockResult,
  UpdatePremiumProgressData,
  UpdatePremiumReviewData,
} from '@/interfaces/repositories/IPremiumQuizRepository';
import type { PremiumPlaySession, PremiumQuizSubmission } from '@/entities/PremiumQuiz';
import { PremiumQuizError } from '@/entities/PremiumQuizError';
import { PremiumQuizPersistenceMapper } from '@/repositories/mappers/PremiumQuizPersistenceMapper';
import type {
  CreditLedgerPersistenceRecord,
  CreditWalletPersistenceRecord,
  PremiumPlaySessionPersistenceRecord,
  PremiumQuizSubmissionPersistenceRecord,
} from '@/repositories/types/PremiumQuizPersistence';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';

const TRANSACTION_OPTIONS = {
  readConcern: { level: 'snapshot' as const },
  writeConcern: { w: 'majority' as const, j: true },
  maxCommitTimeMS: 5_000,
};

const IDLE_SESSION_MS = 2 * 60 * 60 * 1000;
const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 2;

interface PremiumCatalogSnapshotProjection {
  title: string;
  slug: string;
  description?: string;
  questions: unknown[];
}

interface PremiumCatalogProjection {
  sourceQuiz: Types.ObjectId;
  snapshot: PremiumCatalogSnapshotProjection;
}

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new PremiumQuizError('not_found', `${label} not found`);
  }
  return new Types.ObjectId(value);
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toStoredSnapshot(
  data: CreatePremiumSubmissionData,
): PremiumQuizSubmissionDocument['snapshot'] {
  return {
    title: data.snapshot.title,
    slug: data.snapshot.slug,
    questions: data.snapshot.questions.map((question) => {
      const base = {
        _id: Types.ObjectId.isValid(question.id)
          ? new Types.ObjectId(question.id)
          : new Types.ObjectId(),
        question: question.question,
        options: question.options,
        ...(question.questionImage === undefined ? {} : { questionImage: question.questionImage }),
        ...(question.optionImages === undefined ? {} : { optionImages: question.optionImages }),
      };
      return question.type === 'single'
        ? { ...base, type: 'single' as const, correctIndex: question.correctIndex }
        : { ...base, type: 'multiple' as const, correctIndexes: question.correctIndexes };
    }),
    ...(data.snapshot.description === undefined ? {} : { description: data.snapshot.description }),
  };
}

async function loadSubmission(
  id: Types.ObjectId,
  session?: ClientSession,
): Promise<PremiumQuizSubmissionPersistenceRecord | null> {
  const query = PremiumQuizSubmissionModel.findById(id);
  if (session) query.session(session);
  return query.lean<PremiumQuizSubmissionPersistenceRecord>();
}

export class PremiumQuizRepository implements IPremiumQuizRepository {
  async isVerifiedUser(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) return false;
    await connectDB();
    return Boolean(
      await User.exists({
        _id: new Types.ObjectId(userId),
        disable: 0,
        emailVerified: { $type: 'date' },
      }),
    );
  }

  async createSubmission(data: CreatePremiumSubmissionData): Promise<PremiumQuizSubmission> {
    await connectDB();
    const sourceQuiz = objectId(data.sourceQuizId, 'Quiz');
    const author = objectId(data.authorId, 'User');
    const latest = await PremiumQuizSubmissionModel.findOne({ sourceQuiz })
      .sort({ version: -1 })
      .select('version')
      .lean<{ version: number }>();

    try {
      const created = await PremiumQuizSubmissionModel.create({
        sourceQuiz,
        author,
        version: (latest?.version ?? 0) + 1,
        status: 'pending',
        sourceType: data.sourceType,
        rightsAttested: data.rightsAttested,
        snapshot: toStoredSnapshot(data),
        snapshotHash: data.snapshotHash,
        questionHashes: data.questionHashes,
        duplicateReport: {
          ...data.duplicateReport,
          matches: data.duplicateReport.matches.map((match) => ({
            ...match,
            submissionId: objectId(match.submissionId, 'Submission'),
            quizId: objectId(match.quizId, 'Quiz'),
          })),
        },
        ...(data.documentFingerprint === undefined
          ? {}
          : { documentFingerprint: data.documentFingerprint }),
        ...(data.sourceObjectKey === undefined ? {} : { sourceObjectKey: data.sourceObjectKey }),
      });
      return PremiumQuizPersistenceMapper.toSubmission(
        created.toObject() as PremiumQuizSubmissionPersistenceRecord,
      );
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      const existing = await PremiumQuizSubmissionModel.findOne({
        sourceQuiz,
        snapshotHash: data.snapshotHash,
      }).lean<PremiumQuizSubmissionPersistenceRecord>();
      if (!existing) throw error;
      return PremiumQuizPersistenceMapper.toSubmission(existing);
    }
  }

  async findSubmissionById(id: string): Promise<PremiumQuizSubmission | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    await connectDB();
    const record = await loadSubmission(new Types.ObjectId(id));
    return record ? PremiumQuizPersistenceMapper.toSubmission(record) : null;
  }

  async findDuplicateCandidates(limit: number): Promise<PremiumQuizSubmission[]> {
    await connectDB();
    const records = await PremiumQuizSubmissionModel.find({ status: 'approved', active: true })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<PremiumQuizSubmissionPersistenceRecord[]>();
    return records.map(PremiumQuizPersistenceMapper.toSubmission);
  }

  async listMine(
    userId: string,
    options: PremiumSubmissionListOptions,
  ): Promise<PremiumSubmissionListResult> {
    return this.list({ author: objectId(userId, 'User') }, options);
  }

  async listAdmin(options: PremiumSubmissionListOptions): Promise<PremiumSubmissionListResult> {
    return this.list({}, options);
  }

  async listCatalog(options: PremiumCatalogListOptions): Promise<PremiumCatalogListResult> {
    await connectDB();
    const normalizedSearch = options.search?.trim();
    const searchPattern = normalizedSearch
      ? new RegExp(escapeRegexLiteral(normalizedSearch), 'i')
      : undefined;
    const filter = {
      status: 'approved',
      active: true,
      ...(searchPattern
        ? {
            $or: [{ 'snapshot.title': searchPattern }, { 'snapshot.description': searchPattern }],
          }
        : {}),
    };
    const skip = (options.page - 1) * options.limit;
    const [records, totalItems] = await Promise.all([
      PremiumQuizSubmissionModel.find(filter)
        .sort({ decidedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .select('sourceQuiz snapshot.title snapshot.slug snapshot.description snapshot.questions')
        .lean<PremiumCatalogProjection[]>(),
      PremiumQuizSubmissionModel.countDocuments(filter),
    ]);
    return {
      items: records.map((record) => ({
        quizId: String(record.sourceQuiz),
        title: record.snapshot.title,
        slug: record.snapshot.slug,
        questionCount: record.snapshot.questions.length,
        ...(record.snapshot.description === undefined
          ? {}
          : { description: record.snapshot.description }),
      })),
      page: options.page,
      limit: options.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / options.limit),
    };
  }

  private async list(
    baseFilter: FilterQuery<PremiumQuizSubmissionDocument>,
    options: PremiumSubmissionListOptions,
  ): Promise<PremiumSubmissionListResult> {
    await connectDB();
    const filter: FilterQuery<PremiumQuizSubmissionDocument> = {
      ...baseFilter,
      ...(options.status === undefined ? {} : { status: options.status }),
    };
    const skip = (options.page - 1) * options.limit;
    const [records, totalItems] = await Promise.all([
      PremiumQuizSubmissionModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .lean<PremiumQuizSubmissionPersistenceRecord[]>(),
      PremiumQuizSubmissionModel.countDocuments(filter),
    ]);
    return {
      items: records.map(PremiumQuizPersistenceMapper.toSubmission),
      page: options.page,
      limit: options.limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / options.limit)),
    };
  }

  async decide(data: PremiumDecisionData): Promise<PremiumDecisionResult> {
    await connectDB();
    const submissionId = objectId(data.submissionId, 'Submission');
    const reviewerId = objectId(data.reviewerId, 'Reviewer');
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const record = await loadSubmission(submissionId, session);
        if (!record) throw new PremiumQuizError('not_found', 'Submission not found');
        if (record.status === 'approved') {
          return {
            submission: PremiumQuizPersistenceMapper.toSubmission(record),
            awardedCredits: record.awardedCredits,
            rewardLocked: record.awardedCredits === 0,
          };
        }

        const now = new Date();
        if (data.decision !== 'approve') {
          const status = data.decision === 'reject' ? 'rejected' : 'changes_requested';
          const updated = await PremiumQuizSubmissionModel.findOneAndUpdate(
            { _id: submissionId, status: record.status },
            {
              $set: {
                status,
                active: false,
                reviewer: reviewerId,
                reviewerNote: data.note ?? '',
                decidedAt: now,
              },
            },
            { new: true, session },
          ).lean<PremiumQuizSubmissionPersistenceRecord>();
          if (!updated) throw new PremiumQuizError('conflict', 'Submission changed concurrently');
          return {
            submission: PremiumQuizPersistenceMapper.toSubmission(updated),
            awardedCredits: 0,
            rewardLocked: false,
          };
        }

        const reviewCurrent =
          record.reviewStatus === 'completed' && record.reviewSnapshotHash === record.snapshotHash;
        if (!reviewCurrent && !data.overrideReason) {
          throw new PremiumQuizError(
            'review_required',
            'A current AI review or an explicit override reason is required',
          );
        }

        const priorRewardFilter: FilterQuery<PremiumQuizSubmissionDocument> = {
          _id: { $ne: submissionId },
          status: 'approved',
          awardedCredits: { $gt: 0 },
          $or: [
            { sourceQuiz: record.sourceQuiz },
            ...(record.documentFingerprint
              ? [{ documentFingerprint: record.documentFingerprint }]
              : []),
          ],
        };
        const rewardLocked = Boolean(
          await PremiumQuizSubmissionModel.exists(priorRewardFilter).session(session),
        );
        const awardedCredits = rewardLocked ? 0 : data.credits;
        if (!rewardLocked && (awardedCredits < 1 || awardedCredits > 5)) {
          throw new PremiumQuizError('invalid_state', 'Approved submissions require 1–5 credits');
        }

        await PremiumQuizSubmissionModel.updateMany(
          { sourceQuiz: record.sourceQuiz, active: true },
          { $set: { active: false } },
          { session },
        );
        const updated = await PremiumQuizSubmissionModel.findOneAndUpdate(
          { _id: submissionId, status: record.status },
          {
            $set: {
              status: 'approved',
              active: true,
              reviewer: reviewerId,
              reviewerNote: data.note ?? '',
              overrideReason: data.overrideReason ?? '',
              awardedCredits,
              decidedAt: now,
            },
          },
          { new: true, session },
        ).lean<PremiumQuizSubmissionPersistenceRecord>();
        if (!updated) throw new PremiumQuizError('conflict', 'Submission changed concurrently');

        if (awardedCredits > 0) {
          const wallet = await CreditWalletModel.findOneAndUpdate(
            { user: record.author },
            { $inc: { balance: awardedCredits }, $setOnInsert: { user: record.author } },
            { upsert: true, new: true, session },
          ).lean<CreditWalletPersistenceRecord>();
          if (!wallet) throw new PremiumQuizError('conflict', 'Credit wallet update failed');
          await CreditLedgerModel.create(
            [
              {
                user: record.author,
                amount: awardedCredits,
                balanceAfter: wallet.balance,
                type: 'submission_reward',
                referenceType: 'premium_submission',
                referenceId: data.submissionId,
                idempotencyKey: `premium-approval:${data.submissionId}`,
                note: data.note,
              },
            ],
            { session },
          );
        }

        return {
          submission: PremiumQuizPersistenceMapper.toSubmission(updated),
          awardedCredits,
          rewardLocked,
        };
      }, TRANSACTION_OPTIONS);
      if (!result) throw new PremiumQuizError('conflict', 'Decision transaction did not commit');
      return result;
    } finally {
      await session.endSession();
    }
  }

  async createReviewJob(data: PremiumReviewJobData): Promise<PremiumReviewJobRecord> {
    await connectDB();
    const submission = await this.findSubmissionById(data.submissionId);
    if (!submission) throw new PremiumQuizError('not_found', 'Submission not found');
    if (submission.snapshotHash !== data.snapshotHash) {
      throw new PremiumQuizError('conflict', 'Submission snapshot changed');
    }
    const job = await PremiumReviewJob.create({
      submission: objectId(data.submissionId, 'Submission'),
      requestedBy: objectId(data.requestedBy, 'User'),
      snapshotHash: data.snapshotHash,
      status: 'queued',
    });
    await PremiumQuizSubmissionModel.updateOne(
      { _id: job.submission, snapshotHash: data.snapshotHash },
      {
        $set: {
          reviewStatus: 'queued',
          reviewJobId: String(job._id),
          reviewSnapshotHash: data.snapshotHash,
        },
        $unset: { reviewError: 1, reviewResult: 1 },
      },
    );
    return {
      id: String(job._id),
      submissionId: data.submissionId,
      snapshotHash: data.snapshotHash,
      status: 'queued',
    };
  }

  async attachUpstreamReviewJob(jobId: string, upstreamJobId: string): Promise<void> {
    await connectDB();
    const updated = await PremiumReviewJob.updateOne(
      { _id: objectId(jobId, 'Review job') },
      { $set: { upstreamJobId } },
    );
    if (updated.matchedCount !== 1) throw new PremiumQuizError('not_found', 'Review job not found');
  }

  async updateReview(data: UpdatePremiumReviewData): Promise<PremiumQuizSubmission> {
    await connectDB();
    const submissionId = objectId(data.submissionId, 'Submission');
    const update = {
      $set: {
        reviewStatus: data.status,
        reviewJobId: data.jobId,
        reviewSnapshotHash: data.snapshotHash,
        ...(data.result === undefined ? {} : { reviewResult: data.result }),
        ...(data.error === undefined ? {} : { reviewError: data.error }),
      },
      ...(data.result === undefined ? {} : { $unset: { reviewError: 1 } }),
    };
    const updated = await PremiumQuizSubmissionModel.findOneAndUpdate(
      { _id: submissionId, snapshotHash: data.snapshotHash },
      update,
      { new: true },
    ).lean<PremiumQuizSubmissionPersistenceRecord>();
    if (!updated) throw new PremiumQuizError('conflict', 'Review no longer matches submission');
    await PremiumReviewJob.updateOne(
      { _id: objectId(data.jobId, 'Review job'), submission: submissionId },
      { $set: { status: data.status, error: data.error } },
    );
    return PremiumQuizPersistenceMapper.toSubmission(updated);
  }

  async getWalletAndLedger(userId: string, limit: number): Promise<CreditLedgerListResult> {
    await connectDB();
    const user = objectId(userId, 'User');
    const wallet = await CreditWalletModel.findOneAndUpdate(
      { user },
      { $setOnInsert: { user, balance: 0 } },
      { upsert: true, new: true },
    ).lean<CreditWalletPersistenceRecord>();
    if (!wallet) throw new PremiumQuizError('conflict', 'Credit wallet unavailable');
    const entries = await CreditLedgerModel.find({ user })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<CreditLedgerPersistenceRecord[]>();
    return {
      wallet: PremiumQuizPersistenceMapper.toWallet(wallet),
      entries: entries.map(PremiumQuizPersistenceMapper.toLedger),
    };
  }

  async grantAdminCredits(data: AdminCreditGrantData): Promise<AdminCreditGrantResult> {
    const note = data.note.trim();
    if (!Number.isInteger(data.amount) || data.amount < 1 || data.amount > 1000) {
      throw new PremiumQuizError(
        'invalid_state',
        'Credit amount must be an integer from 1 to 1000',
      );
    }
    if (note.length < 3 || note.length > 500) {
      throw new PremiumQuizError('invalid_state', 'Credit adjustment reason is invalid');
    }
    await connectDB();
    const user = objectId(data.userId, 'User');
    const adminUser = objectId(data.adminUserId, 'Admin');
    const idempotencyKey = `admin-credit:${data.adminUserId}:${data.idempotencyKey}`;
    const session = await mongoose.startSession();

    const toResult = (
      ledger: CreditLedgerPersistenceRecord,
      alreadyApplied: boolean,
    ): AdminCreditGrantResult => {
      const matchesRequest =
        ledger.user.toString() === user.toString() &&
        ledger.amount === data.amount &&
        ledger.type === 'admin_adjustment' &&
        ledger.referenceType === 'admin' &&
        ledger.referenceId === adminUser.toString() &&
        ledger.note === note;
      if (!matchesRequest) {
        throw new PremiumQuizError('conflict', 'Idempotency key belongs to another adjustment');
      }
      return {
        userId: data.userId,
        amount: ledger.amount,
        balance: ledger.balanceAfter,
        ledgerEntryId: ledger._id.toString(),
        alreadyApplied,
      };
    };

    try {
      const result = await session.withTransaction(async () => {
        const existing = await CreditLedgerModel.findOne({ idempotencyKey })
          .session(session)
          .lean<CreditLedgerPersistenceRecord>();
        if (existing) return toResult(existing, true);

        const targetExists = await User.exists({ _id: user }).session(session);
        if (!targetExists) throw new PremiumQuizError('not_found', 'User not found');

        const wallet = await CreditWalletModel.findOneAndUpdate(
          { user },
          { $inc: { balance: data.amount }, $setOnInsert: { user } },
          { upsert: true, new: true, session },
        ).lean<CreditWalletPersistenceRecord>();
        if (!wallet) throw new PremiumQuizError('conflict', 'Credit wallet update failed');

        const ledgerRows = await CreditLedgerModel.create(
          [
            {
              user,
              amount: data.amount,
              balanceAfter: wallet.balance,
              type: 'admin_adjustment',
              referenceType: 'admin',
              referenceId: adminUser.toString(),
              idempotencyKey,
              note,
            },
          ],
          { session },
        );
        const ledger = ledgerRows[0];
        if (!ledger) throw new PremiumQuizError('conflict', 'Credit ledger write failed');
        return {
          userId: data.userId,
          amount: data.amount,
          balance: wallet.balance,
          ledgerEntryId: ledger._id.toString(),
          alreadyApplied: false,
        };
      }, TRANSACTION_OPTIONS);
      if (!result) throw new PremiumQuizError('conflict', 'Credit adjustment did not commit');
      return result;
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      const existing = await CreditLedgerModel.findOne({
        idempotencyKey,
      }).lean<CreditLedgerPersistenceRecord>();
      if (!existing) throw error;
      return toResult(existing, true);
    } finally {
      await session.endSession();
    }
  }

  async unlock(data: PremiumUnlockData): Promise<PremiumUnlockResult> {
    await connectDB();
    const user = objectId(data.userId, 'User');
    const quiz = objectId(data.quizId, 'Quiz');
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const existingGrant = await PremiumQuizAccessGrant.findOne({ user, quiz })
          .session(session)
          .lean<{ _id: Types.ObjectId }>();
        const currentWallet = await CreditWalletModel.findOne({ user })
          .session(session)
          .lean<CreditWalletPersistenceRecord>();
        if (existingGrant) {
          return { granted: true, alreadyGranted: true, balance: currentWallet?.balance ?? 0 };
        }

        const publication = await PremiumQuizSubmissionModel.findOne({
          sourceQuiz: quiz,
          status: 'approved',
          active: true,
        })
          .session(session)
          .select('_id')
          .lean<{ _id: Types.ObjectId }>();
        if (!publication) throw new PremiumQuizError('not_found', 'Premium quiz not found');

        const wallet = await CreditWalletModel.findOneAndUpdate(
          { user, balance: { $gte: 1 } },
          { $inc: { balance: -1 } },
          { new: true, session },
        ).lean<CreditWalletPersistenceRecord>();
        if (!wallet) throw new PremiumQuizError('insufficient_credits', 'Not enough credits');

        const idempotencyKey = `premium-unlock:${data.userId}:${data.idempotencyKey}`;
        const ledgerRows = await CreditLedgerModel.create(
          [
            {
              user,
              amount: -1,
              balanceAfter: wallet.balance,
              type: 'quiz_unlock',
              referenceType: 'premium_quiz',
              referenceId: data.quizId,
              idempotencyKey,
            },
          ],
          { session },
        );
        const ledger = ledgerRows[0];
        if (!ledger) throw new PremiumQuizError('conflict', 'Credit ledger write failed');
        await PremiumQuizAccessGrant.create([{ user, quiz, ledgerEntry: ledger._id }], { session });
        return { granted: true, alreadyGranted: false, balance: wallet.balance };
      }, TRANSACTION_OPTIONS);
      if (!result) throw new PremiumQuizError('conflict', 'Unlock transaction did not commit');
      return result;
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      const grant = await PremiumQuizAccessGrant.exists({ user, quiz });
      if (!grant) throw error;
      const wallet = await CreditWalletModel.findOne({ user })
        .select('balance')
        .lean<{ balance: number }>();
      return { granted: true, alreadyGranted: true, balance: wallet?.balance ?? 0 };
    } finally {
      await session.endSession();
    }
  }

  async hasGrant(userId: string, quizId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(quizId)) return false;
    await connectDB();
    return Boolean(
      await PremiumQuizAccessGrant.exists({
        user: new Types.ObjectId(userId),
        quiz: new Types.ObjectId(quizId),
      }),
    );
  }

  async findActivePublicationByQuizId(quizId: string): Promise<PremiumQuizSubmission | null> {
    if (!Types.ObjectId.isValid(quizId)) return null;
    await connectDB();
    const record = await PremiumQuizSubmissionModel.findOne({
      sourceQuiz: new Types.ObjectId(quizId),
      status: 'approved',
      active: true,
    }).lean<PremiumQuizSubmissionPersistenceRecord>();
    return record ? PremiumQuizPersistenceMapper.toSubmission(record) : null;
  }

  async findActivePublicationBySlug(slug: string): Promise<PremiumQuizSubmission | null> {
    await connectDB();
    const record = await PremiumQuizSubmissionModel.findOne({
      'snapshot.slug': slug,
      status: 'approved',
      active: true,
    }).lean<PremiumQuizSubmissionPersistenceRecord>();
    return record ? PremiumQuizPersistenceMapper.toSubmission(record) : null;
  }

  async createSession(data: CreatePremiumSessionData): Promise<PremiumPlaySession> {
    await connectDB();
    const user = objectId(data.userId, 'User');
    const quiz = objectId(data.quizId, 'Quiz');
    const submission = objectId(data.submissionId, 'Submission');
    const activeSessions = await PremiumPlaySessionModel.countDocuments({
      user,
      quiz,
      completedAt: { $exists: false },
      idleExpiresAt: { $gt: data.now },
      absoluteExpiresAt: { $gt: data.now },
    });
    if (activeSessions >= MAX_ACTIVE_SESSIONS) {
      const existing = await PremiumPlaySessionModel.findOne({
        user,
        quiz,
        completedAt: { $exists: false },
        idleExpiresAt: { $gt: data.now },
        absoluteExpiresAt: { $gt: data.now },
      })
        .sort({ updatedAt: -1 })
        .lean<PremiumPlaySessionPersistenceRecord>();
      if (existing) return PremiumQuizPersistenceMapper.toSession(existing);
    }
    const resumable =
      activeSessions === 0
        ? await PremiumPlaySessionModel.findOne({
            user,
            quiz,
            submission,
            snapshotHash: data.snapshotHash,
            completedAt: { $exists: false },
            $or: [{ idleExpiresAt: { $lte: data.now } }, { absoluteExpiresAt: { $lte: data.now } }],
          })
            .sort({ updatedAt: -1 })
            .select('answers currentQuestionIndex highestBatch')
            .lean<
              Pick<
                PremiumPlaySessionPersistenceRecord,
                'answers' | 'currentQuestionIndex' | 'highestBatch'
              >
            >()
        : null;
    const created = await PremiumPlaySessionModel.create({
      user,
      quiz,
      submission,
      snapshotHash: data.snapshotHash,
      answers: resumable?.answers ?? [],
      currentQuestionIndex: resumable?.currentQuestionIndex ?? 0,
      highestBatch: resumable?.highestBatch ?? 0,
      sessionCode: randomBytes(6).toString('hex').toUpperCase(),
      idleExpiresAt: new Date(data.now.getTime() + IDLE_SESSION_MS),
      absoluteExpiresAt: new Date(data.now.getTime() + ABSOLUTE_SESSION_MS),
      purgeAt: new Date(data.now.getTime() + SESSION_RETENTION_MS),
      batchWindowStartedAt: data.now,
      batchRequestCount: 0,
    });
    return PremiumQuizPersistenceMapper.toSession(
      created.toObject() as PremiumPlaySessionPersistenceRecord,
    );
  }

  async findSession(sessionId: string, userId: string): Promise<PremiumPlaySession | null> {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) return null;
    await connectDB();
    const record = await PremiumPlaySessionModel.findOne({
      _id: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
    }).lean<PremiumPlaySessionPersistenceRecord>();
    return record ? PremiumQuizPersistenceMapper.toSession(record) : null;
  }

  async consumeBatchQuota(sessionId: string, userId: string, now: Date): Promise<boolean> {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) return false;
    await connectDB();
    const cutoff = new Date(now.getTime() - 60_000);
    const updated = await PremiumPlaySessionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        completedAt: { $exists: false },
        idleExpiresAt: { $gt: now },
        absoluteExpiresAt: { $gt: now },
        $expr: {
          $or: [{ $lte: ['$batchWindowStartedAt', cutoff] }, { $lt: ['$batchRequestCount', 30] }],
        },
      },
      [
        {
          $set: {
            batchRequestCount: {
              $cond: [
                { $lte: ['$batchWindowStartedAt', cutoff] },
                1,
                { $add: ['$batchRequestCount', 1] },
              ],
            },
            batchWindowStartedAt: {
              $cond: [{ $lte: ['$batchWindowStartedAt', cutoff] }, now, '$batchWindowStartedAt'],
            },
          },
        },
      ],
      { new: true },
    ).select('_id');
    return Boolean(updated);
  }

  async updateProgress(data: UpdatePremiumProgressData): Promise<PremiumPlaySession | null> {
    await connectDB();
    const sessionId = objectId(data.sessionId, 'Session');
    const userId = objectId(data.userId, 'User');
    const current = await PremiumPlaySessionModel.findOne({
      _id: sessionId,
      user: userId,
      completedAt: { $exists: false },
      idleExpiresAt: { $gt: data.now },
      absoluteExpiresAt: { $gt: data.now },
    });
    if (!current) return null;
    const stored = {
      questionIndex: data.questionIndex,
      ...(Array.isArray(data.answer)
        ? { selectedIndexes: data.answer }
        : { selectedIndex: data.answer }),
    };
    const existingIndex = current.answers.findIndex(
      (answer) => answer.questionIndex === data.questionIndex,
    );
    if (existingIndex >= 0) current.answers[existingIndex] = stored;
    else current.answers.push(stored);
    current.currentQuestionIndex = data.questionIndex;
    current.highestBatch = Math.max(current.highestBatch, Math.floor(data.questionIndex / 3));
    current.idleExpiresAt = new Date(
      Math.min(data.now.getTime() + IDLE_SESSION_MS, current.absoluteExpiresAt.getTime()),
    );
    await current.save();
    return PremiumQuizPersistenceMapper.toSession(
      current.toObject() as PremiumPlaySessionPersistenceRecord,
    );
  }

  async completeSession(
    sessionId: string,
    userId: string,
    now: Date,
  ): Promise<PremiumPlaySession | null> {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) return null;
    await connectDB();
    const record = await PremiumPlaySessionModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(sessionId),
        user: new Types.ObjectId(userId),
        completedAt: { $exists: false },
        submissionIdempotencyKey: { $exists: true },
      },
      { $set: { completedAt: now } },
      { new: true },
    ).lean<PremiumPlaySessionPersistenceRecord>();
    return record ? PremiumQuizPersistenceMapper.toSession(record) : null;
  }

  async claimSessionSubmission(
    sessionId: string,
    userId: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<'claimed' | 'replay' | 'conflict' | 'expired'> {
    if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(userId)) return 'expired';
    await connectDB();
    const identity = {
      _id: new Types.ObjectId(sessionId),
      user: new Types.ObjectId(userId),
    };
    const existing = await PremiumPlaySessionModel.findOne(identity)
      .select('submissionIdempotencyKey completedAt idleExpiresAt absoluteExpiresAt')
      .lean<{
        submissionIdempotencyKey?: string;
        completedAt?: Date;
        idleExpiresAt: Date;
        absoluteExpiresAt: Date;
      }>();
    if (!existing) return 'expired';
    if (existing.submissionIdempotencyKey !== undefined) {
      return existing.submissionIdempotencyKey === idempotencyKey ? 'replay' : 'conflict';
    }
    if (
      existing.completedAt !== undefined ||
      existing.idleExpiresAt <= now ||
      existing.absoluteExpiresAt <= now
    ) {
      return 'expired';
    }
    const claimed = await PremiumPlaySessionModel.updateOne(
      {
        ...identity,
        submissionIdempotencyKey: { $exists: false },
        completedAt: { $exists: false },
        idleExpiresAt: { $gt: now },
        absoluteExpiresAt: { $gt: now },
      },
      { $set: { submissionIdempotencyKey: idempotencyKey } },
    );
    if (claimed.modifiedCount === 1) return 'claimed';
    const raced = await PremiumPlaySessionModel.findOne(identity)
      .select('submissionIdempotencyKey')
      .lean<{ submissionIdempotencyKey?: string }>();
    if (raced?.submissionIdempotencyKey === idempotencyKey) return 'replay';
    return raced?.submissionIdempotencyKey ? 'conflict' : 'expired';
  }
}
