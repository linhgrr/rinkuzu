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
  IQuizAttemptProgressRepository,
  RecordedQuizAttempt,
  RecordQuizAttemptProgressData,
} from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { QuizAttemptIdempotencyConflictError } from '@/errors/quiz-attempt';
import { toUtcDateKey } from '@/lib/date-serialization';
import { retainRecentWeeklyActivity } from '@/lib/learning-progress-retention.mjs';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';

interface DailyActivity {
  questionsReviewed: number;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

interface MutableUserProgress {
  isNew: boolean;
  totalXp: number;
  totalQuizzesTaken: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakFreezeCount: number;
  weeklyActivity: Map<string, DailyActivity>;
  averageAccuracy: number;
}

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
type AttemptIdentity = { user: string } | { guestEmail: string };
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
interface UserAttemptIdempotencyFilter {
  idempotencyKey: string;
  $and: [UserEqualityPredicate, UserTypePredicate];
}
interface GuestAttemptIdempotencyFilter {
  idempotencyKey: string;
  $and: [GuestEmailEqualityPredicate, GuestEmailTypePredicate];
}
type AttemptIdempotencyFilter = UserAttemptIdempotencyFilter | GuestAttemptIdempotencyFilter;
type QuestionProgressWrites = Parameters<typeof QuestionProgress.bulkWrite>[0];

const TRANSACTION_ATTEMPTS = 2;

function correctIndexesFrom(
  question: RecordQuizAttemptProgressData['wrongQuestions'][number]['question'],
): number[] {
  if (question.type === 'single') {
    if (!Number.isInteger(question.correctIndex)) {
      throw new TypeError('Single-choice question.correctIndex is required');
    }
    return [question.correctIndex];
  }
  if (!question.correctIndexes?.length) {
    throw new TypeError('Multiple-choice question.correctIndexes is required');
  }
  return question.correctIndexes;
}

function createSubmissionDigest(data: RecordQuizAttemptProgressData): string {
  return createHash('sha256')
    .update(JSON.stringify({ quizId: data.quizId, answers: data.answers }))
    .digest('hex');
}

function attemptIdentity(data: RecordQuizAttemptProgressData): AttemptIdentity {
  if (data.userId) return { user: data.userId };
  if (data.guestEmail) return { guestEmail: data.guestEmail };
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

function buildQuestionProgressWrites(
  data: RecordQuizAttemptProgressData,
  now: Date,
): QuestionProgressWrites {
  const uniqueWrongQuestions = new Map(
    data.wrongQuestions.map((wrong) => [wrong.questionId, wrong]),
  );

  return Array.from(uniqueWrongQuestions.values()).map((wrong) => ({
    updateOne: {
      filter: {
        userId: data.userId,
        quizSlug: data.quizSlug,
        questionId: wrong.questionId,
      },
      update: {
        $setOnInsert: {
          userId: data.userId,
          quizSlug: data.quizSlug,
          questionId: wrong.questionId,
          questionRef: {
            text: wrong.question.question,
            options: wrong.question.options,
            correctIndexes: correctIndexesFrom(wrong.question),
          },
          srsLevel: 0,
          interval: 0,
          easeFactor: 2.5,
          nextReviewDate: now,
          lastReviewDate: null,
          correctStreak: 0,
          totalReviews: 0,
          totalCorrect: 0,
          history: [],
        },
      },
      upsert: true,
    },
  }));
}

function applySubmittedAttemptToUserProgress(
  progress: MutableUserProgress,
  data: AuthenticatedQuizAttemptSubmission,
  now: Date,
): void {
  const xpGain = data.correctAnswers * 10;
  progress.totalXp += xpGain;
  progress.totalQuizzesTaken += 1;

  const lastActive = progress.isNew ? null : new Date(progress.lastActiveDate);
  const todayKey = toUtcDateKey(now, 'attempt.takenAt');
  const lastActiveKey = lastActive ? toUtcDateKey(lastActive, 'userProgress.lastActiveDate') : null;

  if (todayKey !== lastActiveKey) {
    if (lastActiveKey) {
      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = toUtcDateKey(yesterday, 'yesterday');

      if (lastActiveKey === yesterdayKey) {
        progress.currentStreak += 1;
      } else {
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
        const twoDaysAgoKey = toUtcDateKey(twoDaysAgo, 'twoDaysAgo');

        if (lastActiveKey === twoDaysAgoKey && progress.streakFreezeCount > 0) {
          progress.streakFreezeCount -= 1;
          progress.currentStreak += 1;
        } else {
          progress.currentStreak = 1;
        }
      }
    } else {
      progress.currentStreak = 1;
    }

    progress.lastActiveDate = now;
    progress.longestStreak = Math.max(progress.longestStreak, progress.currentStreak);
  }

  const currentActivity = progress.weeklyActivity.get(todayKey) ?? {
    questionsReviewed: 0,
    xpEarned: 0,
    correctCount: 0,
    totalCount: 0,
  };
  currentActivity.questionsReviewed += data.totalQuestions;
  currentActivity.xpEarned += xpGain;
  currentActivity.correctCount += data.correctAnswers;
  currentActivity.totalCount += data.totalQuestions;
  progress.weeklyActivity.set(todayKey, currentActivity);

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return toUtcDateKey(date, 'weeklyActivity.date');
  });
  let totalCorrectWeek = 0;
  let totalQuestionsWeek = 0;
  for (const dayKey of last7Days) {
    const activity = progress.weeklyActivity.get(dayKey);
    if (activity) {
      totalCorrectWeek += activity.correctCount;
      totalQuestionsWeek += activity.totalCount;
    }
  }
  progress.averageAccuracy =
    totalQuestionsWeek > 0 ? Math.round((totalCorrectWeek / totalQuestionsWeek) * 100) : 0;
  progress.weeklyActivity = retainRecentWeeklyActivity(
    progress.weeklyActivity,
    progress.lastActiveDate,
  );
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
        quizSnapshot: {
          ...data.quizSnapshot,
          questions: data.quizSnapshot.questions.map(({ id, ...question }) => ({
            _id: id,
            ...question,
          })),
        },
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

export class QuizAttemptProgressRepository implements IQuizAttemptProgressRepository {
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
        let result: RecordedQuizAttempt | null = null;
        try {
          await session.withTransaction(async () => {
            result = await recordSubmissionTransaction(data, submissionDigest, session);
          });
          if (!result) throw new Error('Quiz attempt transaction did not commit');
          return result;
        } catch (error) {
          if (!isMongoDuplicateKeyError(error)) throw error;

          const existing = await findExistingAttempt(data, null);
          if (existing) return assertMatchingSubmission(existing, submissionDigest);
          if (transactionAttempt === TRANSACTION_ATTEMPTS) throw error;
        }
      }
    } finally {
      await session.endSession();
    }

    throw new Error('Quiz attempt transaction exhausted without a result');
  }
}
