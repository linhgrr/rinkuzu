import { createHash } from 'node:crypto';
import mongoose, { type ClientSession } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { serializeId } from '@/lib/mongo-id';
import AttemptModel from '@/models/Attempt';
import QuestionProgress from '@/models/QuestionProgress';
import QuizProgress from '@/models/QuizProgress';
import UserProgress from '@/models/UserProgress';
import type {
  IGuestAttemptClaimRepository,
  IQuizAttemptProgressRepository,
  RecordedQuizAttempt,
  RecordQuizAttemptProgressData,
} from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import {
  applySubmittedAttemptToUserProgress,
  buildQuestionProgressWrites,
} from '@/repositories/quiz-attempt-progress-writes';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';
import { evaluateQuizAttempt } from '@/services/quiz/quiz-attempt-evaluation';
import { logger } from '@/lib/logger';

interface StoredSubmittedAttempt {
  _id: unknown;
  submissionDigest: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
}

type AuthenticatedQuizAttemptSubmission = Extract<
  RecordQuizAttemptProgressData,
  { userId: string }
>;
type AttemptIdentity = { user: string } | { guestEmail: string } | { guestClaimTokenHash: string };
interface MongoTypePredicate<T extends string> {
  $type: T;
}
interface UserEqualityPredicate {
  user: string;
}
interface UserTypePredicate {
  user: MongoTypePredicate<'objectId'>;
}
interface GuestEmailEqualityPredicate {
  guestEmail: string;
}
interface GuestEmailTypePredicate {
  guestEmail: MongoTypePredicate<'string'>;
}
interface GuestClaimTokenEqualityPredicate {
  guestClaimTokenHash: string;
}
interface GuestClaimTokenTypePredicate {
  guestClaimTokenHash: MongoTypePredicate<'string'>;
}
interface UserAttemptIdempotencyFilter {
  idempotencyKey: string;
  $and: [UserEqualityPredicate, UserTypePredicate];
}
interface GuestAttemptIdempotencyFilter {
  idempotencyKey: string;
  $and: [GuestEmailEqualityPredicate, GuestEmailTypePredicate];
}
interface GuestClaimTokenAttemptIdempotencyFilter {
  idempotencyKey: string;
  $and: [GuestClaimTokenEqualityPredicate, GuestClaimTokenTypePredicate];
}
type AttemptIdempotencyFilter =
  | UserAttemptIdempotencyFilter
  | GuestAttemptIdempotencyFilter
  | GuestClaimTokenAttemptIdempotencyFilter;
const TRANSACTION_ATTEMPTS = 2;

function createSubmissionDigest(data: RecordQuizAttemptProgressData): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        quizId: data.quizId,
        answers: data.answers,
        premiumSubmissionId: data.premiumSubmissionId,
        premiumSnapshotHash: data.premiumSnapshotHash,
        retryOfAttemptId: data.retryOfAttemptId,
        questionIndices: data.questionIndices,
        mode: data.mode,
      }),
    )
    .digest('hex');
}

function attemptIdentity(data: RecordQuizAttemptProgressData): AttemptIdentity {
  if (data.userId) return { user: data.userId };
  if (data.guestEmail) return { guestEmail: data.guestEmail };
  if (data.guestClaimTokenHash) return { guestClaimTokenHash: data.guestClaimTokenHash };
  throw new TypeError('Attempt identity is required');
}

function attemptIdempotencyFilter(data: RecordQuizAttemptProgressData): AttemptIdempotencyFilter {
  if (data.userId) {
    return {
      idempotencyKey: data.idempotencyKey,
      $and: [{ user: data.userId }, { user: { $type: 'objectId' } }],
    };
  }
  if (data.guestEmail) {
    return {
      idempotencyKey: data.idempotencyKey,
      $and: [{ guestEmail: data.guestEmail }, { guestEmail: { $type: 'string' } }],
    };
  }
  if (data.guestClaimTokenHash) {
    return {
      idempotencyKey: data.idempotencyKey,
      $and: [
        { guestClaimTokenHash: data.guestClaimTokenHash },
        { guestClaimTokenHash: { $type: 'string' } },
      ],
    };
  }
  throw new TypeError('Attempt identity is required');
}

function toRecordedAttempt(record: StoredSubmittedAttempt): RecordedQuizAttempt {
  return {
    id: serializeId(record._id, 'attempt._id'),
    score: record.score,
    correctAnswers: record.correctAnswers,
    totalQuestions: record.totalQuestions,
  };
}

function assertMatchingSubmission(
  record: StoredSubmittedAttempt,
  submissionDigest: string,
): RecordedQuizAttempt {
  if (record.submissionDigest !== submissionDigest) {
    throw new QuizAttemptIdempotencyConflictError();
  }
  return toRecordedAttempt(record);
}

async function findExistingAttempt(
  data: RecordQuizAttemptProgressData,
  session: ClientSession | null,
): Promise<StoredSubmittedAttempt | null> {
  return AttemptModel.findOne(attemptIdempotencyFilter(data))
    .select('_id submissionDigest score correctAnswers totalQuestions')
    .session(session)
    .lean<StoredSubmittedAttempt>();
}

async function createAttempt(
  data: RecordQuizAttemptProgressData,
  submissionDigest: string,
  session: ClientSession,
): Promise<RecordedQuizAttempt> {
  const [document] = await AttemptModel.create(
    [
      {
        ...attemptIdentity(data),
        idempotencyKey: data.idempotencyKey,
        submissionDigest,
        quiz: data.quizId,
        ...(data.premiumSubmissionId !== undefined
          ? { premiumSubmission: data.premiumSubmissionId }
          : {}),
        ...(data.premiumSnapshotHash !== undefined
          ? { premiumSnapshotHash: data.premiumSnapshotHash }
          : {}),
        quizSnapshot: {
          ...data.quizSnapshot,
          questions: data.quizSnapshot.questions.map(({ id, ...question }) => ({
            _id: id,
            ...question,
          })),
        },
        ...(data.retryOfAttemptId === undefined ? {} : { retryOfAttemptId: data.retryOfAttemptId }),
        ...(data.questionIndices === undefined ? {} : { questionIndices: data.questionIndices }),
        ...(data.mode === undefined ? {} : { mode: data.mode }),
        answers: data.answers.map(AnswerPersistenceMapper.toPersistence),
        score: data.score,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions,
        takenAt: data.takenAt,
      },
    ],
    { session },
  );
  if (!document) throw new Error('Attempt transaction did not create a document');
  return {
    id: serializeId(document._id, 'attempt._id'),
    score: document.score,
    correctAnswers: document.correctAnswers,
    totalQuestions: document.totalQuestions,
  };
}

async function recordAuthenticatedProgress(
  data: AuthenticatedQuizAttemptSubmission,
  session: ClientSession,
): Promise<void> {
  const now = data.takenAt;
  const questionProgressWrites = buildQuestionProgressWrites(data, now);
  if (questionProgressWrites.length > 0) {
    await QuestionProgress.bulkWrite(questionProgressWrites, { ordered: false, session });
  }

  let userProgress = await UserProgress.findOne({ userId: data.userId }).session(session);
  userProgress ??= new UserProgress({ userId: data.userId });
  applySubmittedAttemptToUserProgress(userProgress, data, now);
  await userProgress.save({ session });

  await QuizProgress.deleteOne({ userId: data.userId, quiz: data.quizId }).session(session);
}

interface ClaimedAttemptSnapshot {
  slug: string;
  questions: QuizQuestionPersistenceRecord[];
}

interface ClaimedAttemptRecord {
  _id: unknown;
  correctAnswers: number;
  totalQuestions: number;
  quizSnapshot: ClaimedAttemptSnapshot;
  answers: SelectedAnswerPersistenceRecord[];
}

interface ClaimedGuestAttempt {
  id: string;
  record: ClaimedAttemptRecord;
}

/**
 * RIN-1028: the review-queue write a signed-in submit makes, for a claimed
 * attempt. Wrong questions come from the same evaluation a submit uses, over
 * the attempt's own snapshot (a retry or quick round already holds only the
 * played questions, in answer order), and the same `$setOnInsert` writes:
 * existing QuestionProgress is never touched.
 */
async function recordClaimedQuestionProgress(
  userId: string,
  claimed: ClaimedGuestAttempt,
  now: Date,
): Promise<void> {
  const { quizSnapshot, answers } = claimed.record;
  const questions = quizSnapshot.questions.map((question, index) =>
    QuizPersistenceMapper.toQuestionEntity(question, index),
  );
  const { wrongQuestions } = evaluateQuizAttempt(
    questions,
    answers.map(AnswerPersistenceMapper.toEntity),
  );
  const writes = buildQuestionProgressWrites(
    { userId, quizSlug: quizSnapshot.slug, wrongQuestions },
    now,
  );
  if (writes.length > 0) await QuestionProgress.bulkWrite(writes, { ordered: false });
}

/**
 * One atomic claim: only an attempt that still holds the hash, has no owner
 * (no `user`, never a `guestEmail` attempt) and was taken since
 * `claimableSince`. Unsetting the hash makes the token single-use.
 */
async function claimOneGuestAttempt(
  userId: string,
  tokenHash: string,
  now: Date,
  claimableSince: Date,
  session: ClientSession,
): Promise<ClaimedGuestAttempt | null> {
  const claimed = await AttemptModel.findOneAndUpdate(
    {
      guestClaimTokenHash: tokenHash,
      user: null,
      guestEmail: null,
      takenAt: { $gte: claimableSince },
    },
    { $set: { user: userId, claimedAt: now }, $unset: { guestClaimTokenHash: '' } },
    {
      new: true,
      projection: {
        _id: 1,
        correctAnswers: 1,
        totalQuestions: 1,
        'quizSnapshot.slug': 1,
        'quizSnapshot.questions': 1,
        answers: 1,
      },
      session,
    },
  ).lean<ClaimedAttemptRecord>();
  if (!claimed) return null;

  // The dashboard reads UserProgress (XP, quizzes taken, streak): apply the
  // write a signed-in submit makes, dated at the claim.
  let userProgress = await UserProgress.findOne({ userId }).session(session);
  userProgress ??= new UserProgress({ userId });
  applySubmittedAttemptToUserProgress(userProgress, claimed, now);
  await userProgress.save({ session });
  return { id: serializeId(claimed._id, 'attempt._id'), record: claimed };
}

async function recordSubmissionTransaction(
  data: RecordQuizAttemptProgressData,
  submissionDigest: string,
  session: ClientSession,
): Promise<RecordedQuizAttempt> {
  const existing = await findExistingAttempt(data, session);
  if (existing) return assertMatchingSubmission(existing, submissionDigest);

  const attempt = await createAttempt(data, submissionDigest, session);
  if (data.userId) {
    await recordAuthenticatedProgress(data, session);
  }
  return attempt;
}

export class QuizAttemptProgressRepository
  implements IQuizAttemptProgressRepository, IGuestAttemptClaimRepository
{
  async recordSubmittedAttempt(data: RecordQuizAttemptProgressData): Promise<RecordedQuizAttempt> {
    await connectDB();
    const submissionDigest = createSubmissionDigest(data);
    const session = await mongoose.startSession();

    try {
      for (
        let transactionAttempt = 1;
        transactionAttempt <= TRANSACTION_ATTEMPTS;
        transactionAttempt++
      ) {
        try {
          // Return the callback's result rather than capturing it: withTransaction
          // has its own retry, and an outer variable survives an attempt that
          // rolled back.
          const result = await session.withTransaction(async () =>
            recordSubmissionTransaction(data, submissionDigest, session),
          );
          if (!result) throw new Error('Quiz attempt transaction did not commit');
          return result;
        } catch (error) {
          if (!isMongoDuplicateKeyError(error)) throw error;

          const existing = await findExistingAttempt(data, null);
          if (existing) return assertMatchingSubmission(existing, submissionDigest);
          // A claim token is single-use: reusing it with another idempotency key is a
          // conflict. Never rethrow the driver error here, its keyValue holds the hash.
          if (data.guestClaimTokenHash) throw new QuizAttemptIdempotencyConflictError();
          if (transactionAttempt === TRANSACTION_ATTEMPTS) throw error;
        }
      }
    } finally {
      await session.endSession();
    }

    throw new Error('Quiz attempt transaction exhausted without a result');
  }

  async claimGuestAttempts(
    userId: string,
    tokenHashes: readonly string[],
    now: Date,
    claimableSince: Date,
  ): Promise<string[]> {
    if (tokenHashes.length === 0) return [];
    await connectDB();
    const session = await mongoose.startSession();
    const claimedIds: string[] = [];
    try {
      for (const tokenHash of new Set(tokenHashes)) {
        const claimed = await session.withTransaction(async () =>
          claimOneGuestAttempt(userId, tokenHash, now, claimableSince, session),
        );
        if (!claimed) continue;
        claimedIds.push(claimed.id);
        // After the commit, on its own: a failed write here would abort the claim
        // transaction, and the claim must stand without it (RIN-1028 AC5).
        try {
          await recordClaimedQuestionProgress(userId, claimed, now);
        } catch (error) {
          logger.warn(
            {
              attemptId: claimed.id,
              errorClass: error instanceof Error ? error.name : typeof error,
            },
            'Claimed guest attempt saved without review-queue progress',
          );
        }
      }
    } finally {
      await session.endSession();
    }
    return claimedIds;
  }
}
