import type {
  PipelineJobHistoryItem,
  PipelineJobListItem,
  TranslateFn,
} from '@/features/adaptive/types';
import { STATUS_LABEL_KEYS } from '@/features/adaptive/lib/pipeline-status-labels';

export type SubjectRuntime =
  | { kind: 'ready' }
  | { kind: 'processing'; progressPercent: number; stageLabel: string; etaSeconds: number | null }
  | { kind: 'retryable'; message: string }
  | { kind: 'cancelling' };

type DashboardSubjectMetrics = {
  masteredConcepts: number;
  allConcepts: number;
  progressPercent: number;
  remainingConcepts: number;
};

export type DashboardSubject = PipelineJobHistoryItem & {
  displayTitle: string;
  lastOpenedLabel: string;
  progressLabel: string;
  ctaLabel: string;
  metrics: DashboardSubjectMetrics;
  runtime: SubjectRuntime;
};

const toTimestampMs = (value?: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;

  return value < 1_000_000_000_000 ? value * 1000 : value;
};

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(100, Math.round(value)));
};

const getSubjectMetrics = (job: PipelineJobHistoryItem): DashboardSubjectMetrics => {
  const masteredConcepts = Math.max(0, job.mastered_concept ?? 0);
  const allConcepts = Math.max(0, job.all_concept ?? job.concepts_after_merge ?? 0);

  if (allConcepts > 0) {
    const boundedMastered = Math.min(masteredConcepts, allConcepts);
    return {
      masteredConcepts: boundedMastered,
      allConcepts,
      progressPercent: clampPercent((boundedMastered / allConcepts) * 100),
      remainingConcepts: Math.max(allConcepts - boundedMastered, 0),
    };
  }

  const fallbackProgress = Math.max(0, job.progress_percent ?? 0);

  return {
    masteredConcepts: 0,
    allConcepts: 0,
    progressPercent: clampPercent(fallbackProgress),
    remainingConcepts: 0,
  };
};

const getDisplayTitle = (job: PipelineJobHistoryItem): string => {
  const filenameTitle = job.filename?.replace(/\.[^.]+$/, '');
  return job.subject_id || filenameTitle || job.job_id;
};

const formatLastOpenedLabel = (
  completedAt: number | undefined,
  locale: string,
  t: TranslateFn,
): string => {
  const timestamp = toTimestampMs(completedAt);
  if (!timestamp) return t('lastOpenedUnknown');

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return new Date(timestamp).toLocaleDateString(locale);

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return t('openedJustNow');
  if (hours < 24) return t('openedHoursAgo', { count: hours });
  if (hours < 48) return t('openedYesterday');

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 7) return t('openedDaysAgo', { count: days });

  return new Date(timestamp).toLocaleDateString(locale);
};

export const toDashboardSubject = (
  job: PipelineJobHistoryItem,
  locale: string,
  t: TranslateFn,
): DashboardSubject => {
  const metrics = getSubjectMetrics(job);

  return {
    ...job,
    displayTitle: getDisplayTitle(job),
    lastOpenedLabel: formatLastOpenedLabel(job.completed_at, locale, t),
    progressLabel: t('progressLabel'),
    ctaLabel: metrics.progressPercent > 0 ? t('continueLearning') : t('startLearning'),
    metrics,
    runtime: { kind: 'ready' },
  };
};

const IN_FLIGHT_STATUSES = new Set<string>([
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

const getJobDisplayTitle = (job: PipelineJobListItem): string => {
  const filenameTitle = job.filename?.replace(/\.[^.]+$/, '');
  return job.subject_id || filenameTitle || job.job_id;
};

export const buildDashboardSubjectFromJob = (
  job: PipelineJobListItem,
  t: TranslateFn,
): DashboardSubject => {
  const displayTitle = getJobDisplayTitle(job);

  let runtime: SubjectRuntime;

  if (job.status === 'completed') {
    runtime = { kind: 'ready' };
  } else if (job.status === 'failed' || job.status === 'cancelled') {
    runtime = {
      kind: 'retryable',
      message: job.user_message || t('processing.errors.pipelineFailed'),
    };
  } else if (IN_FLIGHT_STATUSES.has(job.status)) {
    runtime = {
      kind: 'processing',
      progressPercent: Math.round(job.progress * 100),
      stageLabel: t(`processing.status.${STATUS_LABEL_KEYS[job.status]}`),
      etaSeconds: job.eta_seconds,
    };
  } else {
    // Unknown / future status — treat as processing with no ETA
    runtime = {
      kind: 'processing',
      progressPercent: Math.round(job.progress * 100),
      stageLabel: t(`processing.status.${STATUS_LABEL_KEYS[job.status] ?? 'waitingToStart'}`),
      etaSeconds: job.eta_seconds,
    };
  }

  const progressPercent = job.status === 'completed' ? 100 : Math.round(job.progress * 100);

  const metrics: DashboardSubjectMetrics = {
    masteredConcepts: 0,
    allConcepts: 0,
    progressPercent,
    remainingConcepts: 0,
  };

  // Synthesise a PipelineJobHistoryItem-shaped base from the list-item fields.
  // History items are completed records with mastery data; for in-flight jobs
  // we fill required numeric fields with safe defaults.
  const base: PipelineJobHistoryItem = {
    job_id: job.job_id,
    filename: job.filename,
    subject_id: job.subject_id,
    status: job.status,
    concepts_extracted: job.concepts_extracted,
    concepts_after_merge: job.concepts_after_merge,
    relations_verified: job.relations_verified,
    completed_at: job.completed_at ?? 0,
    mastered_concept: 0,
    all_concept: 0,
    progress_percent: progressPercent,
  };

  return {
    ...base,
    displayTitle,
    lastOpenedLabel: t('lastOpenedUnknown'),
    progressLabel: t('progressLabel'),
    ctaLabel:
      job.status === 'completed'
        ? progressPercent > 0
          ? t('continueLearning')
          : t('startLearning')
        : t('processing.status.processing'),
    metrics,
    runtime,
  };
};
