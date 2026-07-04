import type { components } from '@/generated/adaptive-api';

type ApiSchemas = components['schemas'];
export type ConceptStatus = ApiSchemas['ConceptStatus'];

export type KnowledgeNode = ApiSchemas['KnowledgeNodeResponse'];

export type KnowledgeGraphData = ApiSchemas['KnowledgeGraphResponse'];

export type MasteryRow = ApiSchemas['MasteryRow'];

export type MasteryMatrixData = ApiSchemas['MasteryMatrixResponse'];

export type ConceptDetail = ApiSchemas['ConceptDetailResponse'];
