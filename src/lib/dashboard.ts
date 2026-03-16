import 'server-only';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';
import { serviceFactory } from '@/lib/serviceFactory';

type DashboardQuiz = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  status?: string;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt?: string;
  questionCount?: number;
  questions: unknown[];
  category: {
    _id?: string;
    name: string;
    color: string;
  };
  author: {
    _id?: string;
    email: string;
  };
};

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

function normalizeId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const candidate = value as {
      toHexString?: () => string;
      toString?: () => string;
      $oid?: unknown;
      id?: unknown;
    };

    if (typeof candidate.toHexString === 'function') {
      return candidate.toHexString();
    }

    if (typeof candidate.$oid === 'string' && candidate.$oid) {
      return candidate.$oid;
    }

    if (
      typeof candidate.id === 'string'
      || typeof candidate.id === 'number'
      || typeof candidate.id === 'bigint'
    ) {
      return String(candidate.id);
    }

    if (typeof candidate.toString === 'function') {
      const text = candidate.toString();
      if (text && text !== '[object Object]') {
        return text;
      }
    }
  }

  return '';
}

function normalizeIsoDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function serializeQuizForClient(rawQuiz: any): DashboardQuiz {
  const category = rawQuiz?.category;
  const author = rawQuiz?.author;

  return {
    _id: normalizeId(rawQuiz?._id),
    title: String(rawQuiz?.title || ''),
    description: String(rawQuiz?.description || ''),
    slug: String(rawQuiz?.slug || ''),
    status: rawQuiz?.status,
    isPrivate: rawQuiz?.isPrivate,
    createdAt: normalizeIsoDate(rawQuiz?.createdAt),
    updatedAt: rawQuiz?.updatedAt ? normalizeIsoDate(rawQuiz.updatedAt) : undefined,
    questionCount: typeof rawQuiz?.questionCount === 'number'
      ? rawQuiz.questionCount
      : Array.isArray(rawQuiz?.questions)
        ? rawQuiz.questions.length
        : 0,
    questions: Array.isArray(rawQuiz?.questions) ? rawQuiz.questions : [],
    category: category
      ? {
        _id: normalizeId(category?._id),
        name: String(category?.name || ''),
        color: String(category?.color || ''),
      }
      : null,
    author: author
      ? {
        _id: author?._id ? normalizeId(author._id) : undefined,
        email: author?.email ? String(author.email) : undefined,
      }
      : null,
  };
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
  quizzes: DashboardQuiz[];
  yourQuizzes: DashboardQuiz[];
}> {
  const quizService = serviceFactory.getQuizService();

  const [stats, quizzesResult, yourQuizzesResult] = await Promise.all([
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
    quizService.getQuizzes({
      page: 1,
      limit: 3,
      userId,
      userRole,
      onlyMine: true,
      compact: true
    }),
  ]);

  return {
    stats,
    quizzes: quizzesResult.quizzes.map(serializeQuizForClient),
    yourQuizzes: yourQuizzesResult.quizzes.map(serializeQuizForClient),
  };
}
