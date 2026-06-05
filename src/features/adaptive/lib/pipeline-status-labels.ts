import type { PipelineStatus } from '@/features/adaptive/types';

export const STATUS_LABEL_KEYS: Record<PipelineStatus, string> = {
  pending: 'waitingToStart',
  queued: 'queuedForProcessing',
  loading: 'readingDocument',
  chunking: 'splittingChunks',
  extracting: 'extractingConceptsWithAI',
  embedding: 'computingEmbeddings',
  merging: 'mergingDuplicateConcepts',
  ranking: 'rankingPrerequisites',
  verifying: 'verifyingRelationsWithAI',
  building_graph: 'buildingKnowledgeGraph',
  optimizing: 'optimizingDAG',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'failed',
};
