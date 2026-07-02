import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];
export type ConceptStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

export type KnowledgeNode = Omit<ApiSchemas['KnowledgeNodeResponse'], 'status'> & {
  status: ConceptStatus;
};

export type KnowledgeGraphData = Omit<ApiSchemas['KnowledgeGraphResponse'], 'nodes'> & {
  nodes: KnowledgeNode[];
};

export type MasteryRow = ApiSchemas['MasteryRow'];

export type MasteryMatrixData = ApiSchemas['MasteryMatrixResponse'];

export type ConceptDetail = Omit<ApiSchemas['ConceptDetailResponse'], 'status'> & {
  status: ConceptStatus;
};
