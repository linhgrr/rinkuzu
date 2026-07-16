import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import UserProgress from '@/models/UserProgress';
import type {
  IQuizAttemptProgressRepository,
  RecordQuizAttemptProgressData,
} from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { toUtcDateKey } from '@/lib/date-serialization';
import { retainRecentWeeklyActivity } from '@/lib/learning-progress-retention.mjs';

function questionIdFrom(data: RecordQuizAttemptProgressData['wrongQuestions'][number]): string {
  return data.questionId;
}

function correctIndexesFrom(
  question: RecordQuizAttemptProgressData['wrongQuestions'][number]['question'],
): number[] {
  if (question.type === 'single') {
    return typeof question.correctIndex === 'number' ? [question.correctIndex] : [];
  }
  if (!question.correctIndexes?.length) {
    throw new TypeError('Multiple-choice question.correctIndexes is required');
  }
  return question.correctIndexes;
}

export class QuizAttemptProgressRepository implements IQuizAttemptProgressRepository {
  async recordSubmittedAttempt(data: RecordQuizAttemptProgressData): Promise<void> {
    await connectDB();

    const uniqueWrongQuestions = new Map<
      string,
      RecordQuizAttemptProgressData['wrongQuestions'][number]
    >();
    for (const wrong of data.wrongQuestions) {
      uniqueWrongQuestions.set(questionIdFrom(wrong), wrong);
    }

    const now = new Date();
    const questionProgressWrites = Array.from(uniqueWrongQuestions.values()).map((wrong) => {
      const questionId = questionIdFrom(wrong);

      return {
        updateOne: {
          filter: {
            userId: data.userId,
            quizSlug: data.quizSlug,
            questionId,
          },
          update: {
            $setOnInsert: {
              userId: data.userId,
              quizSlug: data.quizSlug,
              questionId,
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
      };
    });

    if (questionProgressWrites.length > 0) {
      await QuestionProgress.bulkWrite(questionProgressWrites, { ordered: false });
    }

    let userProgress = await UserProgress.findOne({ userId: data.userId });

    if (!userProgress) {
      userProgress = new UserProgress({ userId: data.userId });
    }

    const xpGain = data.correctAnswers * 10;
    userProgress.totalXp += xpGain;
    userProgress.totalQuizzesTaken += 1;

    const lastActive = userProgress.lastActiveDate ? new Date(userProgress.lastActiveDate) : null;
    const todayKey = toUtcDateKey(now, 'attempt.takenAt');
    const lastActiveKey = lastActive
      ? toUtcDateKey(lastActive, 'userProgress.lastActiveDate')
      : null;

    if (todayKey !== lastActiveKey) {
      if (lastActiveKey) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = toUtcDateKey(yesterday, 'yesterday');

        if (lastActiveKey === yesterdayKey) {
          userProgress.currentStreak += 1;
        } else {
          const twoDaysAgo = new Date(now);
          twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
          const twoDaysAgoKey = toUtcDateKey(twoDaysAgo, 'twoDaysAgo');

          if (lastActiveKey === twoDaysAgoKey && userProgress.streakFreezeCount > 0) {
            userProgress.streakFreezeCount -= 1;
            userProgress.currentStreak += 1;
          } else {
            userProgress.currentStreak = 1;
          }
        }
      } else {
        userProgress.currentStreak = 1;
      }

      userProgress.lastActiveDate = now;

      if (userProgress.currentStreak > userProgress.longestStreak) {
        userProgress.longestStreak = userProgress.currentStreak;
      }
    }

    if (!userProgress.weeklyActivity) {
      userProgress.weeklyActivity = new Map();
    }

    const currentActivity = userProgress.weeklyActivity.get(todayKey) || {
      questionsReviewed: 0,
      xpEarned: 0,
      correctCount: 0,
      totalCount: 0,
    };

    currentActivity.questionsReviewed += data.totalQuestions;
    currentActivity.xpEarned += xpGain;
    currentActivity.correctCount += data.correctAnswers;
    currentActivity.totalCount += data.totalQuestions;

    userProgress.weeklyActivity.set(todayKey, currentActivity);

    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      last7Days.push(toUtcDateKey(date, 'weeklyActivity.date'));
    }

    let totalCorrectWeek = 0;
    let totalQuestionsWeek = 0;
    for (const dayKey of last7Days) {
      const dayActivity = userProgress.weeklyActivity.get(dayKey);
      if (dayActivity) {
        totalCorrectWeek += dayActivity.correctCount;
        totalQuestionsWeek += dayActivity.totalCount;
      }
    }

    userProgress.averageAccuracy =
      totalQuestionsWeek > 0 ? Math.round((totalCorrectWeek / totalQuestionsWeek) * 100) : 0;
    userProgress.weeklyActivity = retainRecentWeeklyActivity(
      userProgress.weeklyActivity,
      userProgress.lastActiveDate,
    );

    await userProgress.save();
  }
}
