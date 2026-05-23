// Barrel file — re-exports all adaptive API client symbols.
// Existing consumers import from this path and continue to work.

export {
  AdaptiveApiError,
  isRetryableAdaptiveError,
  isAdaptiveApiError,
  isAdaptivePipelineNotReadyError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
  isSessionNotFoundError,
} from './adaptive-api-error';

export {
  getNextConcept,
  getTheory,
  getExercise,
  submitAnswer,
  getSessionStatus,
  getKnowledgeGraph,
  getMasteryMatrix,
  getConceptDetail,
  checkApiHealth,
  uploadPdf,
  getPipelineJobStatus,
  createSessionFromPipeline,
  getSubjectProgressHistory,
  getSubjectHistoryDetail,
  getSubjectHistoryDetailFresh,
  prefetchStartLearningData,
  getSubjects,
  deleteSubject,
} from './adaptive-api-methods';
