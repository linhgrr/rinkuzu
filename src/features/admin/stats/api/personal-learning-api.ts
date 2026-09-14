import type { components } from '@/generated/adaptive-api';
import { fetchApiData } from '@/lib/api/client';
import type {
  PersonalLearningBreakdownRowViewModel,
  PersonalLearningSubjectViewModel,
  PersonalLearningSubjectsFilters,
  PersonalLearningSubjectsViewModel,
  PersonalLearningSummaryViewModel,
  PersonalLearningWindow,
} from '@/features/admin/stats/types/personal-learning-view-model';

type ApiSchemas = components['schemas'];
type SummaryDto = ApiSchemas['PersonalLearningSummaryResponse'];
type SubjectsDto = ApiSchemas['PersonalLearningSubjectsResponse'];
type BreakdownDto = ApiSchemas['PersonalLearningBreakdownRow'];

/**
 * `display_name` / `email` are attached by the Next.js admin proxy from the
 * account store; the adaptive contract never carries learner identity.
 */
type EnrichedSubjectDto = SubjectsDto['subjects'][number] & {
  display_name?: string | null;
  email?: string | null;
};

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

function toSubject(dto: EnrichedSubjectDto): PersonalLearningSubjectViewModel {
  return {
    jobId: dto.job_id,
    userId: dto.user_id ?? null,
    displayName: dto.display_name ?? null,
    email: dto.email ?? null,
    filename: dto.filename,
    subjectId: dto.subject_id,
    pipelineStatus: dto.pipeline_status,
    progressStatus: dto.progress_status ?? null,
    safeErrorCode: dto.safe_error_code ?? null,
    retryable: dto.retryable,
    partialSuccess: dto.partial_success,
    conceptsExtracted: dto.concepts_extracted,
    conceptsAfterMerge: dto.concepts_after_merge,
    relationsAccepted: dto.relations_accepted,
    totalAnswers: dto.total_answers,
    totalCorrect: dto.total_correct,
    accuracy: dto.accuracy,
    averageMastery: dto.average_mastery,
    progressPercent: dto.progress_percent,
    masteredConcepts: dto.mastered_concepts,
    lastSessionId: dto.last_session_id ?? null,
    durationSeconds: dto.duration_seconds ?? null,
    createdAt: dto.created_at,
    completedAt: dto.completed_at ?? null,
    lastActivityAt: dto.last_activity_at ?? null,
  };
}

export async function fetchPersonalLearningSubjects(
  filters: PersonalLearningSubjectsFilters,
  signal?: AbortSignal,
): Promise<PersonalLearningSubjectsViewModel> {
  const params = new URLSearchParams({ window: filters.window });
  if (filters.search) params.set('search', filters.search);
  if (filters.pipelineStatus) params.set('pipeline_status', filters.pipelineStatus);
  if (filters.progressStatus) params.set('progress_status', filters.progressStatus);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));

  const dto = await fetchApiData<{ subjects: EnrichedSubjectDto[]; next_cursor?: string | null }>(
    `/api/admin/personal-learning/subjects?${params}`,
    { cache: 'no-store', signal },
  );

  return {
    subjects: dto.subjects.map(toSubject),
    nextCursor: dto.next_cursor ?? null,
  };
}
