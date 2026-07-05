import type {
  DashboardBootstrapDto,
  DashboardInProgressQuizDto,
  DashboardStatsDto,
} from '@/dtos/dashboard';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import { toPipelineJobHistoryItem } from '@/features/adaptive/mappers/pipeline.mapper';
import type {
  IDashboardRepository,
  DashboardUserProgressRecord,
} from '@/interfaces/repositories/IDashboardRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IDashboardService } from '@/interfaces/services/IDashboardService';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { DashboardDtoMapper } from '@/mappers/dashboard/DashboardDtoMapper';
import { QuizListDtoMapper } from '@/mappers/quiz/QuizListDtoMapper';
import type { QuizListItemDto } from '@/dtos/quiz';
import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];
const HOME_ADAPTIVE_SUBJECT_LIMIT = 4;
const HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS = 1_500;
const HOME_IN_PROGRESS_QUIZ_LIMIT = 6;
const HOME_QUIZ_SECTION_LIMIT = 4;

const EMPTY_DASHBOARD_USER_PROGRESS: DashboardUserProgressRecord = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezeCount: 0,
  totalXp: 0,
  weeklyActivity: {},
  totalQuestionsLearned: 0,
  totalReviewSessions: 0,
  averageAccuracy: 0,
};

export class DashboardService implements IDashboardService {
  constructor(
    private readonly repository: IDashboardRepository,
    private readonly quizRepository: IQuizRepository,
  ) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const [progress, dueCount] = await Promise.all([
      this.repository.findUserProgress(userId),
      this.repository.countDueQuestions(userId, new Date()),
    ]);
    return DashboardDtoMapper.toStats(progress ?? EMPTY_DASHBOARD_USER_PROGRESS, dueCount);
  }

  private async getAdaptiveSubjects(userId: string): Promise<PipelineJobHistoryItem[]> {
    const timeoutMs = Math.min(resolveAdaptiveProxyTimeoutMs(), HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS);

    try {
      const data = await fetchApiData<ApiSchemas['SubjectHistoryListResponse']>(
        `${resolveAdaptiveApiUrl()}/api/history/subjects`,
        {
          headers: buildAdaptiveServiceHeaders(userId),
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      return data.subjects.map(toPipelineJobHistoryItem).slice(0, HOME_ADAPTIVE_SUBJECT_LIMIT);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching adaptive subjects for home dashboard');
      return [];
    }
  }

  private async getInProgressQuizzes(userId: string): Promise<DashboardInProgressQuizDto[]> {
    try {
      const records = await this.repository.findInProgressQuizzes(
        userId,
        HOME_IN_PROGRESS_QUIZ_LIMIT,
      );
      return records.map(DashboardDtoMapper.toInProgressQuiz);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching in-progress quizzes for home dashboard');
      return [];
    }
  }

  private async getRecentOwnedQuizzes(userId: string): Promise<QuizListItemDto[]> {
    try {
      const result = await this.quizRepository.findAll(
        { author: userId },
        {
          page: 1,
          limit: HOME_QUIZ_SECTION_LIMIT,
          sort: { createdAt: -1 },
          compact: true,
        },
      );
      return result.items.map(QuizListDtoMapper.toListItem);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching recent owned quizzes for home dashboard');
      return [];
    }
  }

  private async getRecentPublicQuizzes(userId: string): Promise<QuizListItemDto[]> {
    try {
      const result = await this.quizRepository.findAll(
        { isPrivate: false, excludeAuthor: userId },
        {
          page: 1,
          limit: HOME_QUIZ_SECTION_LIMIT,
          sort: { createdAt: -1 },
          populate: ['author'],
          compact: true,
        },
      );
      return result.items.map(QuizListDtoMapper.toListItem);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching recent public quizzes for home dashboard');
      return [];
    }
  }

  async getBootstrapData(userId: string): Promise<DashboardBootstrapDto> {
    const [stats, adaptiveSubjects, inProgressQuizzes, recentOwnedQuizzes, recentPublicQuizzes] =
      await Promise.all([
        this.getStats(userId),
        this.getAdaptiveSubjects(userId),
        this.getInProgressQuizzes(userId),
        this.getRecentOwnedQuizzes(userId),
        this.getRecentPublicQuizzes(userId),
      ]);

    return {
      stats,
      adaptiveSubjects,
      inProgressQuizzes,
      recentOwnedQuizzes,
      recentPublicQuizzes,
    };
  }
}
