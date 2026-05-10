// Barrel file — re-exports all adaptive-learning API client symbols.
// Existing consumers import from this path and continue to work.

export {
  AdaptiveApiError,
  isRetryableAdaptiveError,
  isAdaptiveApiError,
  isSessionNotFoundError,
} from './adaptive-api-error';

export {
  createSession,
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
  checkPipelineAvailable,
  getSubjectProgressHistory,
  getSubjectHistoryDetail,
  getSubjectHistoryDetailFresh,
  prefetchStartLearningData,
  getPipelineJobHistory,
  getSubjects,
  deleteSubject,
} from './adaptive-api-methods';
