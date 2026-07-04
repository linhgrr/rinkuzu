import type { components } from '@/generated/adaptive-api';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import type { PipelineJobHistoryItem, PipelineStatus } from '@/features/adaptive/types/pipeline';
import type { SubjectProgressItem, SubjectProgressStatus } from '@/features/adaptive/types/history';

type ApiSchemas = components['schemas'];

const PIPELINE_STATUSES: ReadonlySet<string> = new Set<PipelineStatus>([
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
  'completed',
  'failed',
  'cancelled',
]);

export function toPipelineStatus(status: string, context: string): PipelineStatus {
  if (PIPELINE_STATUSES.has(status)) return status as PipelineStatus;
  throw new AdaptiveApiError({
    message: `Unsupported adaptive pipeline status: ${status}`,
    code: 'upstream_invalid_envelope',
    detail: context,
    retryable: true,
  });
}

export function toPipelineJobHistoryItem(
  subject: ApiSchemas['SubjectHistoryResponse'],
): PipelineJobHistoryItem {
  return subject;
}

const SUBJECT_PROGRESS_STATUSES: ReadonlySet<string> = new Set<SubjectProgressStatus>([
  'active',
  'completed',
]);

export function toSubjectProgressItem(
  subject: ApiSchemas['SubjectProgressSummaryResponse'],
): SubjectProgressItem {
  if (!SUBJECT_PROGRESS_STATUSES.has(subject.status)) {
    throw new AdaptiveApiError({
      message: `Unsupported adaptive subject progress status: ${subject.status}`,
      code: 'upstream_invalid_envelope',
      detail: `subject progress ${subject.job_id}`,
      retryable: true,
    });
  }
  return subject;
}
