import type {
  DashboardBootstrapDto,
  DashboardInProgressQuizDto,
  DashboardStatsDto,
} from '@/dtos/dashboard';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types/pipeline';
import { toPipelineJobHistoryItem } from '@/features/adaptive/mappers/pipeline.mapper';
import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import type { IDashboardService } from '@/interfaces/services/IDashboardService';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from '@/lib/adaptive/config';
import { fetchApiData } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { DashboardDtoMapper } from '@/mappers/dashboard/DashboardDtoMapper';
import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];
const HOME_ADAPTIVE_SUBJECT_LIMIT = 4;
const HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS = 1_500;
const HOME_IN_PROGRESS_QUIZ_LIMIT = 6;
export class DashboardService implements IDashboardService {
  constructor(private readonly repository: IDashboardRepository) {}

  async getStats(userId: string): Promise<DashboardStatsDto> {
    const [progress, dueCount] = await Promise.all([
      this.repository.findUserProgress(userId),
      this.repository.countDueQuestions(userId, new Date()),
    ]);
    return DashboardDtoMapper.toStats(progress, dueCount);
  }

  private async getAdaptiveSubjects(userId: string): Promise<PipelineJobHistoryItem[]> {
    const timeoutMs = Math.min(resolveAdaptiveProxyTimeoutMs(), HOME_ADAPTIVE_SUBJECT_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const data = await fetchApiData<ApiSchemas['SubjectHistoryListResponse']>(
        `${resolveAdaptiveApiUrl()}/api/history/subjects`,
        {
          headers: buildAdaptiveServiceHeaders(userId),
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      return data.subjects.map(toPipelineJobHistoryItem).slice(0, HOME_ADAPTIVE_SUBJECT_LIMIT);
    } catch (error) {
      logger.warn({ error }, 'Failed fetching adaptive subjects for home dashboard');
      return [];
    } finally {
      clearTimeout(timeout);
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

  async getBootstrapData(userId: string): Promise<DashboardBootstrapDto> {
    const [stats, adaptiveSubjects, inProgressQuizzes] = await Promise.all([
      this.getStats(userId),
      this.getAdaptiveSubjects(userId),
      this.getInProgressQuizzes(userId),
    ]);

    return {
      stats,
      adaptiveSubjects,
      inProgressQuizzes,
    };
  }
}
