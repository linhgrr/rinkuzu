import QuestionProgress from '@/models/QuestionProgress';
import type { RecordQuizAttemptProgressData } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { toUtcDateKey } from '@/lib/date-serialization';
import { retainRecentWeeklyActivity } from '@/lib/learning-progress-retention.mjs';

/**
 * The progress writes a signed-in quiz submit makes, shared by the submit and
 * the guest-attempt claim (RIN-1028) so the SRS and gamification rules exist once.
 */

type AuthenticatedQuizAttemptSubmission = Extract<
  RecordQuizAttemptProgressData,
  { userId: string }
>;

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

type QuestionProgressWrites = Parameters<typeof QuestionProgress.bulkWrite>[0];
type QuestionProgressSource = Pick<
  AuthenticatedQuizAttemptSubmission,
  'userId' | 'quizSlug' | 'wrongQuestions'
>;

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

export function buildQuestionProgressWrites(
  data: QuestionProgressSource,
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

export function applySubmittedAttemptToUserProgress(
  progress: MutableUserProgress,
  data: Pick<AuthenticatedQuizAttemptSubmission, 'correctAnswers' | 'totalQuestions'>,
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
