import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';

export const adminStatsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminStatsListQueryDto = z.infer<typeof adminStatsListQuerySchema>;

export type AdminGrowthPeriodDto = 7 | 30 | 90 | 365;

const adminGrowthPeriodSchema = z
  .enum(['7', '30', '90', '365'])
  .default('30')
  .transform((value): AdminGrowthPeriodDto => Number(value) as AdminGrowthPeriodDto);

export const adminGrowthQuerySchema = z.object({
  days: adminGrowthPeriodSchema,
});

export interface AdminOverviewStatsDto {
  totalQuizzes: number;
  totalUsers: number;
  totalAdmins: number;
  totalAttempts: number;
}

export interface AdminScoreStatsDto {
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  scoreDistribution: AdminScoreDistributionBucketDto[];
}

interface AdminScoreDistributionBucketDto {
  range: string;
  min: number;
  max: number;
  count: number;
  passing: boolean;
}

interface AdminGrowthDataPointDto {
  date: string;
  newUsers: number;
  newQuizzes: number;
  attempts: number;
  averageScore: number | null;
}

interface AdminMetricComparisonDto {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface AdminGrowthTrendsDto {
  period: AdminGrowthPeriodDto;
  from: string;
  to: string;
  data: AdminGrowthDataPointDto[];
  comparison: {
    newUsers: AdminMetricComparisonDto;
    newQuizzes: AdminMetricComparisonDto;
    attempts: AdminMetricComparisonDto;
    averageScore: AdminMetricComparisonDto;
  };
}

interface AdminTimeBucketDto {
  newUsers: number;
  newQuizzes: number;
  attempts: number;
}

export interface AdminRecentUserDto {
  email: string;
  createdAt: string;
}

interface AdminRecentQuizDto {
  title: string;
  createdAt: string;
  author: {
    id: string;
    email?: string;
    name?: string;
    displayName?: string;
    avatar?: string;
  };
  questionCount: number;
}

export interface AdminRecentAttemptDto {
  id: string;
  score: number;
  takenAt: string;
  answeredQuestions: number;
  actor: {
    email: string;
    type: 'user' | 'guest';
  };
  quiz: { title: string };
}

export interface AdminActivityStatsDto {
  timeBasedStats: {
    today: AdminTimeBucketDto;
    thisWeek: AdminTimeBucketDto;
    thisMonth: AdminTimeBucketDto;
  };
  recentActivity: {
    users: AdminRecentUserDto[];
    quizzes: AdminRecentQuizDto[];
    attempts: AdminRecentAttemptDto[];
  };
}

export interface AdminCreatorStatDto {
  id: string;
  email: string;
  quizCount: number;
  totalQuestions: number;
  joinedAt: string;
  role: 'admin' | 'user';
}

export interface AdminStatsDto extends AdminOverviewStatsDto, AdminActivityStatsDto {
  overview: AdminOverviewStatsDto;
  topCreators: AdminCreatorStatDto[];
  scoreStats: AdminScoreStatsDto;
  growthTrends: AdminGrowthTrendsDto;
}

export interface AdminCreatorStatsListDto {
  creators: AdminCreatorStatDto[];
  pagination: PaginationMeta;
}

export interface AdminActivityStatsListDto {
  activities: Array<
    | {
        id: string;
        type: 'user';
        date: string;
        data: AdminRecentUserDto;
      }
    | {
        id: string;
        type: 'quiz';
        date: string;
        data: AdminRecentQuizDto;
      }
    | {
        id: string;
        type: 'attempt';
        date: string;
        data: AdminRecentAttemptDto;
      }
  >;
  pagination: PaginationMeta;
}

const ADMIN_ACTIVATION_DEFAULT_WEEKS = 8;
const ADMIN_ACTIVATION_MAX_WEEKS = 26;

export const adminActivationQuerySchema = z.object({
  weeks: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_ACTIVATION_MAX_WEEKS)
    .default(ADMIN_ACTIVATION_DEFAULT_WEEKS),
});

const isoInstantSchema = z.iso.datetime();
const countSchema = z.number().int().min(0);

/** quiz only, adaptive only, both: the three add up to the learner count. */
const activationPathCountsSchema = z
  .object({ quiz: countSchema, adaptive: countSchema, both: countSchema })
  .strict();

/** The cohort split, plus `claimedGuest`: a subset of activated, not a fourth path. */
const cohortPathCountsSchema = activationPathCountsSchema
  .extend({ claimedGuest: countSchema })
  .strict();

const adminActivationWeekSchema = z
  .object({
    isoWeek: z.string().regex(/^\d{4}-W\d{2}$/),
    start: isoInstantSchema,
    end: isoInstantSchema,
    signups: countSchema,
    signedIn: countSchema,
    material: countSchema,
    startedQuiz: countSchema,
    activated: countSchema,
    activatedBy: cohortPathCountsSchema,
    weeklyActivatedLearners: countSchema,
    weeklyActivatedBy: activationPathCountsSchema,
    w1Retained: countSchema.nullable(),
    w1RetentionRate: z.number().min(0).max(1).nullable(),
    returnedWeek1: countSchema.nullable(),
    complete: z.boolean(),
  })
  .strict();

/**
 * Aggregate-only by contract: integers, rates, dates and definition strings.
 * Strict at every level so a future field cannot leak learner data unnoticed.
 */
export const adminActivationStatsSchema = z
  .object({
    generatedAt: isoInstantSchema,
    timezone: z.literal('UTC'),
    definitions: z
      .object({
        week: z.string(),
        exclusions: z.string(),
        signups: z.string(),
        signedIn: z.string(),
        material: z.string(),
        startedQuiz: z.string(),
        activated: z.string(),
        activatedBy: z.string(),
        weeklyActivatedLearners: z.string(),
        weeklyActivatedBy: z.string(),
        adaptiveCompletion: z.string(),
        succeededUpload: z.string(),
        w1Retained: z.string(),
        w1RetentionRate: z.string(),
        returnedWeek1: z.string(),
        complete: z.string(),
        sources: z.string(),
        limitations: z.string(),
      })
      .strict(),
    // 'unavailable': the adaptive API did not answer, so every number is
    // quiz-only and undercounts Path B learners.
    sources: z.object({ adaptive: z.enum(['ok', 'unavailable']) }).strict(),
    weeks: z.array(adminActivationWeekSchema),
  })
  .strict();

export type AdminActivationWeekDto = z.infer<typeof adminActivationWeekSchema>;
export type AdminActivationStatsDto = z.infer<typeof adminActivationStatsSchema>;
