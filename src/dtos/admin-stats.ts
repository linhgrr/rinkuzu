import type { PaginationMeta } from '@/dtos/common';
import { z } from 'zod';

export const adminStatsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminStatsListQueryDto = z.infer<typeof adminStatsListQuerySchema>;

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
  scoreStats: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
  growthTrends: {
    users: Array<{ year: number; month: number; count: number }>;
    quizzes: Array<{ year: number; month: number; count: number }>;
    attempts: Array<{ year: number; month: number; count: number }>;
  };
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
