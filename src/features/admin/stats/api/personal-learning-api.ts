import type { AdminLearnerSearchDto } from '@/dtos/admin-learner';
import type { components } from '@/generated/adaptive-api';
import { fetchApiData } from '@/lib/api/client';
import type {
  LearnerIdentityViewModel,
  LearnerSubjectViewModel,
  PersonalLearningBreakdownRowViewModel,
  PersonalLearningSummaryViewModel,
  PersonalLearningWindow,
} from '@/features/admin/stats/types/personal-learning-view-model';

type ApiSchemas = components['schemas'];
type SummaryDto = ApiSchemas['PersonalLearningSummaryResponse'];
type BreakdownDto = ApiSchemas['PersonalLearningBreakdownRow'];
type LearnerSubjectsDto = ApiSchemas['LearnerSubjectsResponse'];

function toBreakdown(rows: BreakdownDto[]): PersonalLearningBreakdownRowViewModel[] {
  return rows.map((row) => ({ key: row.key, count: row.count }));
}

export async function fetchPersonalLearningSummary(
  window: PersonalLearningWindow,
  signal?: AbortSignal,
): Promise<PersonalLearningSummaryViewModel> {
  const dto = await fetchApiData<SummaryDto>(
    `/api/admin/personal-learning/summary?window=${window}`,
    { cache: 'no-store', ...(signal ? { signal } : {}) },
  );

  return {
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

export async function searchLearners(
  search: string,
  signal?: AbortSignal,
): Promise<LearnerIdentityViewModel[]> {
  const dto = await fetchApiData<AdminLearnerSearchDto>(
    `/api/admin/personal-learning/learners?${new URLSearchParams({ search })}`,
    { cache: 'no-store', ...(signal ? { signal } : {}) },
  );
  return dto.learners.map(({ id, displayName, email }) => ({ id, displayName, email }));
}

/** One learner's subjects. The route records an admin audit entry per call. */
export async function fetchLearnerSubjects(
  userId: string,
  signal?: AbortSignal,
): Promise<LearnerSubjectViewModel[]> {
  const dto = await fetchApiData<LearnerSubjectsDto>(
    `/api/admin/personal-learning/subjects?${new URLSearchParams({ user_id: userId, limit: '100' })}`,
    { cache: 'no-store', ...(signal ? { signal } : {}) },
  );
  return dto.subjects.map((subject) => ({
    jobId: subject.job_id,
    filename: subject.filename,
    pipelineStatus: subject.pipeline_status,
    progressStatus: subject.progress_status ?? null,
    accuracy: subject.accuracy,
    progressPercent: subject.progress_percent,
    lastActivityAt: subject.last_activity_at ?? null,
  }));
}
