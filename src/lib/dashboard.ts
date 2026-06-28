import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import Quiz from '@/models/Quiz';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types';
import { serviceFactory } from '@/lib/serviceFactory';
import type { IQuizProgress } from '@/interfaces/repositories/IQuizProgressRepository';
import { Types } from 'mongoose';

type DashboardQuiz = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt?: string;
  questionCount?: number;
  questions: unknown[];
  author?: {
    _id?: string;
    email: string;
  } | null;
};

export type DashboardInProgressQuiz = {
  quizId: string;
  title: string;
  slug: string;
  answeredCount: number;
  totalQuestions: number;
  updatedAt: string;
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
  isPrivate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  questionCount?: unknown;
};

const HOME_ADAPTIVE_SUBJECT_LIMIT = 4;
const HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS = 800;

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
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function serializeQuizForClient(rawQuiz: unknown): DashboardQuiz {
  const quiz = (rawQuiz ?? {}) as Record<string, unknown>;
  const author = quiz['author'] as Record<string, unknown> | null | undefined;
  const questions = Array.isArray(quiz['questions']) ? (quiz['questions'] as unknown[]) : [];

  return {
    _id: normalizeId(quiz['_id']),
    title: String(quiz['title'] || ''),
    description: String(quiz['description'] || ''),
    slug: String(quiz['slug'] || ''),
    isPrivate: Boolean(quiz['isPrivate']),
    createdAt: normalizeIsoDate(quiz['createdAt']),
    updatedAt: quiz['updatedAt'] ? normalizeIsoDate(quiz['updatedAt']) : undefined,
    questionCount:
      typeof quiz['questionCount'] === 'number'
        ? (quiz['questionCount'] as number)
        : questions.length,
    questions: questions as DashboardQuiz['questions'],
    author: author
      ? {
          _id: author['_id'] ? normalizeId(author['_id']) : undefined,
          email: author['email'] ? String(author['email']) : '',
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
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        slug: 1,
        isPrivate: 1,
        createdAt: 1,
        updatedAt: 1,
        questionCount: { $size: { $ifNull: ['$questions', []] } },
        // Keep payload small for dashboard cards.
        questions: { $literal: [] },
      },
    },
  ]).exec();

  return quizzes.map(serializeQuizForClient);
}

const getCachedPublicDashboardQuizzes = unstable_cache(
  async () => getDashboardQuizList({ isPrivate: false }, 3),
  ['dashboard-public-quizzes-v1'],
  {
    revalidate: 60,
  },
);

async function getDashboardAdaptiveSubjects(userId: string): Promise<PipelineJobHistoryItem[]> {
  const timeoutMs = Math.min(resolveAdaptiveProxyTimeoutMs(), HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const data = await fetchApiData<{ subjects?: PipelineJobHistoryItem[] }>(
      `${resolveAdaptiveApiUrl()}/api/history/subjects`,
      {
        headers: buildAdaptiveServiceHeaders(userId),
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    return (data.subjects ?? []).slice(0, HOME_ADAPTIVE_SUBJECT_LIMIT);
  } catch (error) {
    logger.warn({ error }, 'Failed fetching adaptive subjects for home dashboard');
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const HOME_IN_PROGRESS_QUIZ_LIMIT = 6;

function serializeInProgressQuiz(raw: IQuizProgress): DashboardInProgressQuiz | null {
  const quiz = raw.quiz;
  if (!quiz || typeof quiz === 'string') {
    return null;
  }

  const slug = typeof quiz.slug === 'string' ? quiz.slug : '';
  if (!slug) {
    return null;
  }

  return {
    quizId: normalizeId(quiz._id),
    title: String(quiz.title || ''),
    slug,
    answeredCount: raw.answeredCount ?? 0,
    totalQuestions: raw.totalQuestions ?? 0,
    updatedAt: normalizeIsoDate(raw.updatedAt),
  };
}

async function getDashboardInProgressQuizzes(
  userId: string,
  limit: number = HOME_IN_PROGRESS_QUIZ_LIMIT,
): Promise<DashboardInProgressQuiz[]> {
  try {
    const repo = serviceFactory.getQuizProgressRepository();
    const records = await repo.findInProgressByUser(userId, limit);
    return records
      .map(serializeInProgressQuiz)
      .filter((item): item is DashboardInProgressQuiz => item !== null);
  } catch (error) {
    logger.warn({ error }, 'Failed fetching in-progress quizzes for home dashboard');
    return [];
  }
}

export const getDashboardBootstrapData = cache(
  async (
    userId: string,
    _userRole?: string,
  ): Promise<{
    stats: DashboardStatsData;
    quizzes: DashboardQuiz[];
    yourQuizzes: DashboardQuiz[];
    adaptiveSubjects: PipelineJobHistoryItem[];
    inProgressQuizzes: DashboardInProgressQuiz[];
  }> => {
    await connectDB();

    const authorFilter: string | Types.ObjectId = Types.ObjectId.isValid(userId)
      ? new Types.ObjectId(userId)
      : userId;

    const [stats, quizzes, yourQuizzes, adaptiveSubjects, inProgressQuizzes] = await Promise.all([
      getUserProgressStats(userId, { skipConnect: true }),
      getCachedPublicDashboardQuizzes(),
      getDashboardQuizList({ author: authorFilter }, 3),
      getDashboardAdaptiveSubjects(userId),
      getDashboardInProgressQuizzes(userId),
    ]);

    return {
      stats,
      quizzes,
      yourQuizzes,
      adaptiveSubjects,
      inProgressQuizzes,
    };
  },
);
