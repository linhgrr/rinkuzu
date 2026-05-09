import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];

export type PipelineUploadResponse = ApiSchemas['PipelineProcessResponse'];
export type PipelineJobStatus = ApiSchemas['PipelineJobStatusResponse'];
export type PipelineSessionResponse = ApiSchemas['PipelineSessionCreateResponse'];
export type PipelineJobHistoryItem = ApiSchemas['SubjectHistoryResponse'];
export type DeleteSubjectResponse = ApiSchemas['DeleteSubjectResponse'];
export type PipelineStatus = PipelineJobStatus['status'];
export type PipelinePartialGraph = NonNullable<PipelineJobStatus['partial_graph']>;
export type PipelinePartialGraphNode = NonNullable<PipelinePartialGraph['nodes']>[number];
export type PipelinePartialGraphEdge = NonNullable<PipelinePartialGraph['edges']>[number];
