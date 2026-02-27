import 'server-only';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';
import { serviceFactory } from '@/lib/serviceFactory';

export interface DashboardStatsData {
  streak: number;
  longestStreak: number;
  streakFreezeCount: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  weeklyActivity: Record<string, {
    questionsReviewed: number;
    xpEarned: number;
    correctCount: number;
    totalCount: number;
  }>;
  totalQuestionsLearned?: number;
  totalReviewSessions?: number;
  averageAccuracy?: number;
}

interface UserProgressStatsDoc {
  currentStreak?: number;
  longestStreak?: number;
  streakFreezeCount?: number;
  totalXp?: number;
  weeklyActivity?: unknown;
  totalQuestionsLearned?: number;
  totalReviewSessions?: number;
  averageAccuracy?: number;
}

function toWeeklyActivityObject(
  activity: unknown
): DashboardStatsData['weeklyActivity'] {
  if (!activity) {
    return {};
  }

  if (activity instanceof Map) {
    return Object.fromEntries(activity) as DashboardStatsData['weeklyActivity'];
  }

  if (typeof activity === 'object') {
    return activity as DashboardStatsData['weeklyActivity'];
  }

  return {};
}

export async function getUserProgressStats(userId: string): Promise<DashboardStatsData> {
  await connectDB();

  const now = new Date();
  const projection =
    'currentStreak longestStreak streakFreezeCount totalXp weeklyActivity totalQuestionsLearned totalReviewSessions averageAccuracy';

  const [existingProgress, dueCount] = await Promise.all([
    UserProgress.findOne({ userId })
      .select(projection)
      .lean<UserProgressStatsDoc>()
      .exec(),
    QuestionProgress.countDocuments({
      userId,
      nextReviewDate: { $lte: now }
    })
  ]);

  let uProgress = existingProgress;

  // Create a progress document only once per user instead of issuing upsert writes on every stats read.
  if (!uProgress) {
    await UserProgress.create({ userId });
    uProgress = await UserProgress.findOne({ userId })
      .select(projection)
      .lean<UserProgressStatsDoc>()
      .exec();
  }

  if (!uProgress) {
    throw new Error('Failed to load user progress');
  }

  const totalXp = uProgress.totalXp ?? 0;
  const level = calculateLevel(totalXp);
  const xpToNextLevel = xpForNextLevel(totalXp);
  const currentLevelProgress = levelProgress(totalXp);

  return {
    streak: uProgress.currentStreak ?? 0,
    longestStreak: uProgress.longestStreak ?? 0,
    streakFreezeCount: uProgress.streakFreezeCount ?? 0,
    xp: totalXp,
    level,
    xpToNextLevel,
    levelProgress: currentLevelProgress,
    dueCount,
    weeklyActivity: toWeeklyActivityObject(uProgress.weeklyActivity),
    totalQuestionsLearned: uProgress.totalQuestionsLearned,
    totalReviewSessions: uProgress.totalReviewSessions,
    averageAccuracy: uProgress.averageAccuracy
  };
}

export async function getDashboardBootstrapData(userId: string, userRole?: string): Promise<{
  stats: DashboardStatsData;
  quizzes: any[];
}> {
  const quizService = serviceFactory.getQuizService();

  const [stats, quizzesResult] = await Promise.all([
    getUserProgressStats(userId),
    quizService.getQuizzes({
      status: 'published',
      page: 1,
      limit: 3,
      isPrivate: false,
      userRole,
      userId,
      compact: true
    }),
  ]);

  return {
    stats,
    quizzes: quizzesResult.quizzes,
  };
}
