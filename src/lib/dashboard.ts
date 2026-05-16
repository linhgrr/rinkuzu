import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';
import { Types } from 'mongoose';

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
  category?: {
    _id?: string;
    name: string;
    color: string;
  } | null;
  author?: {
    _id?: string;
    email: string;
  } | null;
};

interface DashboardStatsData {
  streak: number;
  longestStreak: number;
  streakFreezeCount: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  weeklyActivity: Record<
    string,
    {
      questionsReviewed: number;
      xpEarned: number;
      correctCount: number;
      totalCount: number;
    }
  >;
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

type DashboardQuizAggregationResult = {
  _id: unknown;
  title?: unknown;
  description?: unknown;
  slug?: unknown;
  status?: unknown;
  isPrivate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  questionCount?: unknown;
  category?: {
    _id?: unknown;
    name?: unknown;
    color?: unknown;
  } | null;
};

function toWeeklyActivityObject(activity: unknown): DashboardStatsData['weeklyActivity'] {
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

function trimWeeklyActivity(
  activity: DashboardStatsData['weeklyActivity'],
  days: number = 14,
): DashboardStatsData['weeklyActivity'] {
  const entries = Object.entries(activity);
  if (entries.length <= days) {
    return activity;
  }

  // Keys are expected to be ISO-like day strings; lexical sorting is stable for this format.
  const latestEntries = entries.sort(([dayA], [dayB]) => dayB.localeCompare(dayA)).slice(0, days);

  return Object.fromEntries(latestEntries);
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
      typeof candidate.id === 'string' ||
      typeof candidate.id === 'number' ||
      typeof candidate.id === 'bigint'
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
    questionCount:
      typeof rawQuiz?.questionCount === 'number'
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
          email: author?.email ? String(author.email) : '',
        }
      : null,
  };
}

export async function getUserProgressStats(
  userId: string,
  options?: { skipConnect?: boolean },
): Promise<DashboardStatsData> {
  if (!options?.skipConnect) {
    await connectDB();
  }

  const now = new Date();
  const projection =
    'currentStreak longestStreak streakFreezeCount totalXp weeklyActivity totalQuestionsLearned totalReviewSessions averageAccuracy';
  const uProgress = await UserProgress.findOne({ userId })
    .select(projection)
    .lean<UserProgressStatsDoc>()
    .exec();

  if (!uProgress) {
    return {
      streak: 0,
      longestStreak: 0,
      streakFreezeCount: 0,
      xp: 0,
      level: calculateLevel(0),
      xpToNextLevel: xpForNextLevel(0),
      levelProgress: levelProgress(0),
      dueCount: 0,
      weeklyActivity: {},
      totalQuestionsLearned: 0,
      totalReviewSessions: 0,
      averageAccuracy: 0,
    };
  }

  const dueCount = await QuestionProgress.countDocuments({
    userId,
    nextReviewDate: { $lte: now },
  });

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
    weeklyActivity: trimWeeklyActivity(toWeeklyActivityObject(uProgress.weeklyActivity)),
    totalQuestionsLearned: uProgress.totalQuestionsLearned,
    totalReviewSessions: uProgress.totalReviewSessions,
    averageAccuracy: uProgress.averageAccuracy,
  };
}

async function getDashboardQuizList(
  filter: Record<string, unknown>,
  limit: number,
): Promise<DashboardQuiz[]> {
  const quizzes = await Quiz.aggregate<DashboardQuizAggregationResult>([
    { $match: filter },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryDoc',
      },
    },
    {
      $unwind: {
        path: '$categoryDoc',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        slug: 1,
        status: 1,
        isPrivate: 1,
        createdAt: 1,
        updatedAt: 1,
        questionCount: { $size: { $ifNull: ['$questions', []] } },
        // Keep payload small for dashboard cards.
        questions: { $literal: [] },
        category: {
          _id: '$categoryDoc._id',
          name: '$categoryDoc.name',
          color: '$categoryDoc.color',
        },
      },
    },
  ]).exec();

  return quizzes.map(serializeQuizForClient);
}

const getCachedPublishedDashboardQuizzes = unstable_cache(
  async () => getDashboardQuizList({ status: 'published', isPrivate: false }, 3),
  ['dashboard-published-quizzes-v1'],
  {
    revalidate: 60,
  },
);

export const getDashboardBootstrapData = cache(
  async (
    userId: string,
    _userRole?: string,
  ): Promise<{
    stats: DashboardStatsData;
    quizzes: DashboardQuiz[];
    yourQuizzes: DashboardQuiz[];
  }> => {
    await connectDB();

    const authorFilter: string | Types.ObjectId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;

    const [stats, quizzes, yourQuizzes] = await Promise.all([
      getUserProgressStats(userId, { skipConnect: true }),
      getCachedPublishedDashboardQuizzes(),
      getDashboardQuizList({ author: authorFilter }, 3),
    ]);

    return {
      stats,
      quizzes,
      yourQuizzes,
    };
  },
);
