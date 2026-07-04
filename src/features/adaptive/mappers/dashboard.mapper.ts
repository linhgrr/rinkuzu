import { STATUS_LABEL_KEYS } from '@/features/adaptive/lib/pipeline-status-labels';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { PipelineJobHistoryItem, PipelineStatus } from '@/features/adaptive/types/pipeline';
import type {
  DashboardPipelineJobListItem,
  DashboardSubject,
  DashboardSubjectMetrics,
  SubjectRuntime,
} from '@/features/adaptive/types/dashboard-view-model';
import { formatDate } from '@/lib/formatters';
import { requireFirstNonEmptyString } from '@/lib/non-empty-string';

const toTimestampMs = (value?: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;

  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(100, Math.round(value)));
};

const getSubjectMetrics = (job: PipelineJobHistoryItem): DashboardSubjectMetrics => {
  const masteredConcepts = Math.max(0, job.mastered_concept);
  const allConcepts = Math.max(0, job.all_concept);

  if (allConcepts > 0) {
    const boundedMastered = Math.min(masteredConcepts, allConcepts);
    return {
      masteredConcepts: boundedMastered,
      allConcepts,
      progressPercent: clampPercent((boundedMastered / allConcepts) * 100),
      remainingConcepts: Math.max(allConcepts - boundedMastered, 0),
    };
  }

  const backendProgressPercent = Math.max(0, job.progress_percent);

  return {
    masteredConcepts: 0,
    allConcepts: 0,
    progressPercent: clampPercent(backendProgressPercent),
    remainingConcepts: 0,
  };
};

const getDisplayTitle = (job: PipelineJobHistoryItem): string => {
  const filenameTitle = job.filename.replace(/\.[^.]+$/, '');
  return requireFirstNonEmptyString(
    'adaptive dashboard subject title',
    job.subject_id,
    filenameTitle,
    job.job_id,
  );
};

const formatLastOpenedLabel = (
  completedAt: number | undefined,
  locale: string,
  t: TranslateFn,
): string => {
  const timestamp = toTimestampMs(completedAt);
  if (!timestamp) return t('lastOpenedUnknown');

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return formatDate(timestamp, { locale });

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return t('openedJustNow');
  if (hours < 24) return t('openedHoursAgo', { count: hours });
  if (hours < 48) return t('openedYesterday');

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 7) return t('openedDaysAgo', { count: days });

  return formatDate(timestamp, { locale });
};

export const toDashboardSubject = (
  job: PipelineJobHistoryItem,
  locale: string,
  t: TranslateFn,
): DashboardSubject => {
  const metrics = getSubjectMetrics(job);

  return {
    jobId: job.job_id,
    filename: job.filename,
    subjectId: job.subject_id,
    status: job.status,
    conceptsExtracted: job.concepts_extracted,
    conceptsAfterMerge: job.concepts_after_merge,
    relationsVerified: job.relations_verified,
    completedAt: job.completed_at ?? null,
    masteredConcept: job.mastered_concept,
    allConcept: job.all_concept,
    progressPercent: job.progress_percent,
    displayTitle: getDisplayTitle(job),
    lastOpenedLabel: formatLastOpenedLabel(job.completed_at, locale, t),
    progressLabel: t('progressLabel'),
    ctaLabel: metrics.progressPercent > 0 ? t('continueLearning') : t('startLearning'),
    metrics,
    runtime: { kind: 'ready' },
  };
};

const IN_FLIGHT_STATUSES: ReadonlySet<PipelineStatus> = new Set([
  'pending',
  'queued',
  'loading',
  'chunking',
  'extracting',
  'embedding',
  'merging',
  'ranking',
  'verifying',
  'building_graph',
  'optimizing',
]);

const getPipelineStatusLabelKey = (status: PipelineStatus): string => {
  return STATUS_LABEL_KEYS[status];
};

const getJobDisplayTitle = (job: DashboardPipelineJobListItem): string => {
  const filenameTitle = job.filename.replace(/\.[^.]+$/, '');
  return requireFirstNonEmptyString(
    'adaptive dashboard job title',
    job.subject_id,
    filenameTitle,
    job.job_id,
  );
};

const getJobProgressPercent = (job: DashboardPipelineJobListItem): number => {
  return clampPercent(job.progress * 100);
};

export const buildDashboardSubjectFromJob = (
  job: DashboardPipelineJobListItem,
  t: TranslateFn,
  tProcessing: TranslateFn = t,
): DashboardSubject => {
  const displayTitle = getJobDisplayTitle(job);

  let runtime: SubjectRuntime;

  if (job.status === 'completed') {
    runtime = { kind: 'ready' };
  } else if (job.status === 'failed' || job.status === 'cancelled') {
    runtime = {
      kind: 'retryable',
      message: job.user_message || tProcessing('processing.errors.pipelineFailed'),
    };
  } else if (IN_FLIGHT_STATUSES.has(job.status)) {
    runtime = {
      kind: 'processing',
      progressPercent: getJobProgressPercent(job),
      stageLabel: tProcessing(`processing.status.${getPipelineStatusLabelKey(job.status)}`),
      etaSeconds: job.eta_seconds ?? null,
    };
  } else {
    throw new TypeError(`Unsupported adaptive pipeline status: ${job.status}`);
  }

  const progressPercent = job.status === 'completed' ? 0 : getJobProgressPercent(job);

  const metrics: DashboardSubjectMetrics = {
    masteredConcepts: 0,
    allConcepts: 0,
    progressPercent,
    remainingConcepts: 0,
  };

  return {
    jobId: job.job_id,
    filename: job.filename,
    subjectId: job.subject_id,
    status: job.status,
    conceptsExtracted: job.concepts_extracted,
    conceptsAfterMerge: job.concepts_after_merge,
    relationsVerified: job.relations_verified,
    completedAt: job.completed_at ?? null,
    masteredConcept: 0,
    allConcept: 0,
    progressPercent,
    displayTitle,
    lastOpenedLabel: t('lastOpenedUnknown'),
    progressLabel: t('progressLabel'),
    ctaLabel:
      job.status === 'completed'
        ? progressPercent > 0
          ? t('continueLearning')
          : t('startLearning')
        : tProcessing('processing.status.processing'),
    metrics,
    runtime,
  };
};
