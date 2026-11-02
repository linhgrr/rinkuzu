import type { components } from '@/generated/adaptive-api';
import { fetchApiData } from '@/lib/api/client';
import type {
  PersonalLearningBreakdownRowViewModel,
  PersonalLearningSummaryViewModel,
  PersonalLearningWindow,
} from '@/features/admin/stats/types/personal-learning-view-model';

type ApiSchemas = components['schemas'];
type SummaryDto = ApiSchemas['PersonalLearningSummaryResponse'];
type BreakdownDto = ApiSchemas['PersonalLearningBreakdownRow'];

function toBreakdown(rows: BreakdownDto[]): PersonalLearningBreakdownRowViewModel[] {
  return rows.map((row) => ({ key: row.key, count: row.count }));
}

export async function fetchPersonalLearningSummary(
  window: PersonalLearningWindow,
  signal?: AbortSignal,
): Promise<PersonalLearningSummaryViewModel> {
  const dto = await fetchApiData<SummaryDto>(
    `/api/admin/personal-learning/summary?window=${window}`,
    { cache: 'no-store', signal },
  );

  return {
    window: dto.window,
    bucket: dto.bucket,
    adoption: {
      activeLearners: dto.totals.active_learners,
      subjectsCreated: dto.totals.subjects_created,
      subjectsCompleted: dto.totals.subjects_completed,
      subjectsWithProgress: dto.totals.subjects_with_progress,
    },
    outcomes: {
      totalAnswers: dto.totals.total_answers,
      totalCorrect: dto.totals.total_correct,
      weightedAccuracy: dto.totals.weighted_accuracy,
      averageMastery: dto.totals.average_mastery,
      averageProgress: dto.totals.average_progress,
      masteredConcepts: dto.totals.mastered_concepts,
    },
    pipeline: {
      totalJobs: dto.pipeline.total_jobs,
      completedJobs: dto.pipeline.completed_jobs,
      failedJobs: dto.pipeline.failed_jobs,
      cancelledJobs: dto.pipeline.cancelled_jobs,
      activeJobs: dto.pipeline.active_jobs,
      partialSuccesses: dto.pipeline.partial_successes,
      retryableFailures: dto.pipeline.retryable_failures,
      successRate: dto.pipeline.success_rate,
      failureRate: dto.pipeline.failure_rate,
      averageDurationSeconds: dto.pipeline.average_duration_seconds,
    },
    pipelineStatuses: toBreakdown(dto.pipeline_statuses),
    progressStatuses: toBreakdown(dto.progress_statuses),
    topErrorCodes: toBreakdown(dto.top_error_codes),
    trend: dto.trend.map((point) => ({
      period: point.period,
      jobsCreated: point.jobs_created,
      jobsCompleted: point.jobs_completed,
      jobsFailed: point.jobs_failed,
      activeLearners: point.active_learners,
      answers: point.answers,
      correctAnswers: point.correct_answers,
    })),
  };
}
