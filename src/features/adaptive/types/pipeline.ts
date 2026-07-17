import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];

export type PipelineStatus = ApiSchemas['PipelineStatus'];
export type PipelineUploadResponse = ApiSchemas['PipelineProcessResponse'];
export type PipelineJobStatus = ApiSchemas['PipelineJobStatusResponse'];
export type PipelineSessionResponse = ApiSchemas['PipelineSessionCreateResponse'];
export type PipelineJobHistoryItem = ApiSchemas['SubjectHistoryResponse'];
export type PipelineJobListItem = ApiSchemas['PipelineJobListItemResponse'];
export type PipelineJobRetryResponse = ApiSchemas['PipelineJobRetryResponse'];
export type PipelineJobCancelResponse = ApiSchemas['PipelineJobCancelResponse'];
export type ReadinessResponse = ApiSchemas['ReadinessResponse'];
export type DeleteSubjectResponse = ApiSchemas['DeleteSubjectResponse'];
export type PipelinePartialGraph = NonNullable<PipelineJobStatus['partial_graph']>;
