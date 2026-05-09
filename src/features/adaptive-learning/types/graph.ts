import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];
type ConceptStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

export type KnowledgeNode = Omit<ApiSchemas['KnowledgeNodeResponse'], 'status'> & {
  status: ConceptStatus;
};

export type KnowledgeEdge = ApiSchemas['KnowledgeEdgeResponse'];

export type KnowledgeGraphData = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type MasteryRow = ApiSchemas['MasteryRow'];

export type MasteryMatrixData = ApiSchemas['MasteryMatrixResponse'];

export type ConceptPrereq = ApiSchemas['ConceptPrereq'];

export type ConceptDetail = Omit<ApiSchemas['ConceptDetailResponse'], 'status'> & {
  status: ConceptStatus;
};
