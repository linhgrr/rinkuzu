import type { components } from '@/generated/adaptive-api';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import type { PipelineJobHistoryItem, PipelineStatus } from '@/features/adaptive/types/pipeline';
import type { SubjectProgressItem } from '@/features/adaptive/types/history';

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
  return {
    ...subject,
    status: toPipelineStatus(subject.status, `subject history ${subject.job_id}`),
  };
}

export function toSubjectProgressItem(
  subject: ApiSchemas['SubjectProgressSummaryResponse'],
): SubjectProgressItem {
  return {
    ...subject,
    status: toPipelineStatus(subject.status, `subject progress ${subject.job_id}`),
  };
}
