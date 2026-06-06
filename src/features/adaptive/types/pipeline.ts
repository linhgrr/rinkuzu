import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];

export type PipelineUploadResponse = ApiSchemas['PipelineProcessResponse'];
export type PipelineJobStatus = ApiSchemas['PipelineJobStatusResponse'];
export type PipelineSessionResponse = ApiSchemas['PipelineSessionCreateResponse'];
export type PipelineJobHistoryItem = ApiSchemas['SubjectHistoryResponse'];
export type DeleteSubjectResponse = ApiSchemas['DeleteSubjectResponse'];
export type PipelineStatus = PipelineJobStatus['status'];
export type PipelinePartialGraph = NonNullable<PipelineJobStatus['partial_graph']>;

export interface PipelineJobListItem {
  job_id: string;
  filename: string;
  subject_id: string;
  status: PipelineStatus;
  current_step: string;
  progress: number;
  page_batch_size: number;
  batch_count: number;
  failed_batch_count: number;
  partial_success: boolean;
  concepts_extracted: number;
  concepts_after_merge: number;
  relations_verified: number;
  error_code: string | null;
  user_message: string | null;
  retryable: boolean;
  retry_count: number;
  eta_seconds: number | null;
  is_terminal: boolean;
  is_delayed: boolean;
  retry_after_seconds: number;
  created_at: number;
  updated_at: number;
  heartbeat_at: number;
  completed_at: number | null;
}
