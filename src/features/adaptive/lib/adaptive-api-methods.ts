import type {
  KnowledgeGraphData,
  MasteryMatrixData,
  ConceptDetail,
  ConceptStatus,
} from '@/features/adaptive/types/graph';
import type {
  ExerciseHistoryFull,
  SubjectProgressItem,
  SubjectHistoryDetail,
} from '@/features/adaptive/types/history';
import type {
  BloomLevel,
  Exercise,
  ExerciseApiResponse,
  ExerciseType,
  LearningStepApiResponse,
  SubmitAnswerPayload,
  SubmitAnswerRequest,
  SubmitResult,
  SessionStatus,
  NextConcept,
  TheoryData,
} from '@/features/adaptive/types/learning';
import type {
  PipelineUploadResponse,
  PipelineJobStatus,
  PipelineSessionResponse,
  PipelineJobHistoryItem,
  DeleteSubjectResponse,
  PipelineJobListItem,
  PipelineJobRetryResponse,
  PipelineJobCancelResponse,
  ReadinessResponse,
} from '@/features/adaptive/types/pipeline';
import type { components } from '@/generated/adaptive-api';
import type { PresignedUploadUrlResponseDto } from '@/dtos/storage';

import {
  timedFetch,
  executeRequest,
  apiFetch,
  PRESIGNED_URL_TIMEOUT_MS,
  OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  PIPELINE_PROCESS_TIMEOUT_MS,
  PIPELINE_STATUS_TIMEOUT_MS,
  PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
} from './adaptive-api-fetch';
import { AdaptiveApiError } from './adaptive-api-error';
import { BLOOM_LABELS } from '@/features/adaptive/types/learning';
import {
  toPipelineJobHistoryItem,
  toSubjectProgressItem,
} from '@/features/adaptive/mappers/pipeline.mapper';

type ApiSchemas = components['schemas'];
const EXERCISE_TYPES: ReadonlySet<string> = new Set<ExerciseType>([
  'mcq',
  'true_false',
  'fill_blank',
  'multi_correct',
  'ordering',
  'matching',
  'short_answer',
]);

const BLOOM_LEVELS: ReadonlySet<string> = new Set<BloomLevel>(BLOOM_LABELS);
const CONCEPT_STATUSES: ReadonlySet<string> = new Set<ConceptStatus>([
  'locked',
  'available',
  'in_progress',
  'mastered',
]);

function invalidAdaptiveEnvelope(message: string, detail: string): AdaptiveApiError {
  return new AdaptiveApiError({
    message,
    code: 'upstream_invalid_envelope',
    detail,
    retryable: true,
  });
}

function normalizeBloomLabel(label: string, context: string): BloomLevel {
  if (BLOOM_LEVELS.has(label)) return label as BloomLevel;
  throw invalidAdaptiveEnvelope(`Unsupported Bloom label: ${label}`, context);
}

function normalizeBloomLevel(level: number, context: string): number {
  if (Number.isInteger(level) && level >= 1 && level <= BLOOM_LABELS.length) return level;
  throw invalidAdaptiveEnvelope(`Unsupported Bloom level: ${level}`, context);
}

function normalizeExerciseType(type: string, context: string): ExerciseType {
  if (EXERCISE_TYPES.has(type)) return type as ExerciseType;
  throw invalidAdaptiveEnvelope(`Unsupported adaptive exercise type: ${type}`, context);
}

function normalizeConceptStatus(status: string, context: string): ConceptStatus {
  if (CONCEPT_STATUSES.has(status)) return status as ConceptStatus;
  throw invalidAdaptiveEnvelope(`Unsupported adaptive concept status: ${status}`, context);
}

function readNumber(record: Record<string, unknown>, key: string, context: string): number {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new AdaptiveApiError({
    message: `Invalid adaptive response field: ${key}`,
    code: 'upstream_invalid_envelope',
    detail: context,
    retryable: true,
  });
}

function requireStringArray(value: string[] | undefined, field: string, context: string): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw invalidAdaptiveEnvelope(`Missing ${field}`, context);
}

function requireString(value: string | undefined, field: string, context: string): string {
  if (typeof value === 'string') return value;
  throw invalidAdaptiveEnvelope(`Missing ${field}`, context);
}

function requireStringRecord(
  value: Record<string, string> | undefined,
  field: string,
  context: string,
): Record<string, string> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  ) {
    return value;
  }
  throw invalidAdaptiveEnvelope(`Missing ${field}`, context);
}

function requireExercisePairs(
  value: ApiSchemas['MatchingPairPayload'][] | undefined,
  field: string,
  context: string,
): ApiSchemas['MatchingPairPayload'][] {
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item.left === 'string' && typeof item.right === 'string')
  ) {
    return value;
  }
  throw invalidAdaptiveEnvelope(`Missing ${field}`, context);
}

function normalizeExerciseResponse(response: ExerciseApiResponse): Exercise {
  const context = `exercise ${response.exercise_id}`;
  const exerciseType = normalizeExerciseType(response.exercise_type, context);
  const recommendationReason = response.recommendation_reason
    ? {
        ...response.recommendation_reason,
        bloom_label: normalizeBloomLabel(
          response.recommendation_reason.bloom_label,
          `${context} recommendation_reason`,
        ),
        satisfied_prereqs: response.recommendation_reason.satisfied_prereqs ?? [],
      }
    : response.recommendation_reason;

  const common = {
    ...response,
    id: response.exercise_id,
    bloom_level: normalizeBloomLevel(response.bloom_level, context),
    bloom_label: normalizeBloomLabel(response.bloom_label, context),
    exercise_type: exerciseType,
    options: {},
    items: [],
    pairs: [],
    right_items: [],
    recommendation_reason: recommendationReason,
  };

  switch (response.exercise_type) {
    case 'mcq':
    case 'multi_correct':
      return {
        ...common,
        options: requireStringRecord(
          response.options,
          `options for ${response.exercise_type} exercise`,
          context,
        ),
      };
    case 'true_false':
      return {
        ...common,
        statement: requireString(response.statement, 'statement for true_false exercise', context),
      };
    case 'fill_blank':
      return {
        ...common,
        sentence: requireString(response.sentence, 'sentence for fill_blank exercise', context),
        hint: requireString(response.hint, 'hint for fill_blank exercise', context),
      };
    case 'ordering':
      return {
        ...common,
        items: requireStringArray(response.items, 'items for ordering exercise', context),
      };
    case 'matching':
      return {
        ...common,
        pairs: requireExercisePairs(response.pairs, 'pairs for matching exercise', context),
        right_items: requireStringArray(
          response.right_items,
          'right_items for matching exercise',
          context,
        ),
      };
    case 'short_answer':
      return {
        ...common,
        rubric: requireStringArray(response.rubric, 'rubric for short_answer exercise', context),
      };
  }
}

function normalizeSubmitResult(response: ApiSchemas['SubmitAnswerResponse']): SubmitResult {
  const context = `submit result for ${response.concept_name}`;
  const stats = response.stats;
  const totalCorrect = readNumber(stats, 'total_correct', context);
  const totalAnswered = readNumber(stats, 'total_answered', context);
  const accuracy = readNumber(stats, 'accuracy', context);

  return {
    ...response,
    stats: {
      total_correct: totalCorrect,
      total_answered: totalAnswered,
      accuracy,
    },
  };
}

function normalizeKnowledgeGraph(
  response: ApiSchemas['KnowledgeGraphResponse'],
): KnowledgeGraphData {
  return {
    ...response,
    nodes: response.nodes.map((node) => ({
      ...node,
      status: normalizeConceptStatus(node.status, `knowledge graph node ${node.id}`),
    })),
  };
}

function normalizeConceptDetail(response: ApiSchemas['ConceptDetailResponse']): ConceptDetail {
  return {
    ...response,
    status: normalizeConceptStatus(response.status, `concept detail ${response.id}`),
  };
}

function normalizeExerciseHistoryItem(
  item: ApiSchemas['ExerciseHistoryResponse'],
  index: number,
): ExerciseHistoryFull {
  const context = `subject exercise_history[${index}]`;
  const { payload, ...history } = item;
  const common = {
    ...history,
    bloom_level: normalizeBloomLevel(item.bloom_level, context),
    sentence: null,
    options: {},
    statement: null,
    hint: null,
    items: [],
    pairs: [],
    right_items: [],
    correct_answer: null,
    correct_option: '',
  };

  switch (payload.exercise_type) {
    case 'mcq':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        options: payload.options,
        correct_option: payload.correct_option,
      };
    case 'true_false':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        statement: payload.statement,
        correct_answer: payload.correct_answer,
        correct_option: String(payload.correct_answer),
      };
    case 'fill_blank':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        sentence: payload.sentence,
        hint: payload.hint,
        correct_answer: payload.blank_answers,
        correct_option: payload.blank_answers.join(', '),
      };
    case 'multi_correct':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        options: payload.options,
        correct_answer: payload.correct_options,
        correct_option: payload.correct_options.join(', '),
      };
    case 'ordering':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        items: payload.correct_order,
        correct_answer: payload.correct_order,
        correct_option: payload.correct_order.join('\n'),
      };
    case 'matching': {
      const correctAnswer = Object.fromEntries(
        payload.pairs.map((pair) => [pair.left, pair.right]),
      );
      return {
        ...common,
        exercise_type: payload.exercise_type,
        pairs: payload.pairs,
        right_items: payload.pairs.map((pair) => pair.right),
        correct_answer: correctAnswer,
        correct_option: payload.pairs.map((pair) => `${pair.left} → ${pair.right}`).join('\n'),
      };
    }
    case 'short_answer':
      return {
        ...common,
        exercise_type: payload.exercise_type,
        rubric: payload.rubric,
        correct_answer: payload.sample_answer,
        correct_option: payload.sample_answer,
      };
  }
}

function normalizeExerciseHistory(
  exerciseHistory: ApiSchemas['SubjectHistoryDetailResponse']['exercise_history'],
): ExerciseHistoryFull[] {
  return exerciseHistory.map(normalizeExerciseHistoryItem);
}

function normalizeSubjectHistoryDetail(
  detail: ApiSchemas['SubjectHistoryDetailResponse'],
): SubjectHistoryDetail {
  return {
    ...detail,
    exercise_history: normalizeExerciseHistory(detail.exercise_history),
  };
}

export async function getNextConcept(sessionId: string): Promise<NextConcept> {
  const response = await apiFetch<ApiSchemas['NextConceptResponse']>(
    `/api/adaptive/session/${sessionId}/next-concept`,
    {
      method: 'POST',
    },
  );
  const context = `next concept for session ${sessionId}`;
  return {
    ...response,
    bloom_level: normalizeBloomLevel(response.bloom_level, context),
    bloom_label: normalizeBloomLabel(response.bloom_label, context),
  };
}

export async function getTheory(sessionId: string): Promise<TheoryData> {
  return apiFetch<ApiSchemas['TheoryResponse']>(`/api/adaptive/session/${sessionId}/theory`, {
    method: 'GET',
  });
}

export async function getExercise(sessionId: string): Promise<Exercise> {
  const response = await apiFetch<ExerciseApiResponse>(
    `/api/adaptive/session/${sessionId}/exercise`,
    {
      method: 'POST',
    },
  );
  return normalizeExerciseResponse(response);
}

export async function getLearningStep(sessionId: string): Promise<{
  concept: NextConcept;
  theory: TheoryData | null;
  exercise: Exercise;
  cache_status: LearningStepApiResponse['cache_status'];
}> {
  const response = await apiFetch<LearningStepApiResponse>(
    `/api/adaptive/session/${sessionId}/step`,
    {
      method: 'POST',
    },
  );
  const context = `learning step for session ${sessionId}`;
  return {
    concept: {
      ...response.concept,
      bloom_level: normalizeBloomLevel(response.concept.bloom_level, context),
      bloom_label: normalizeBloomLabel(response.concept.bloom_label, context),
    },
    theory: response.theory ?? null,
    exercise: normalizeExerciseResponse(response.exercise),
    cache_status: response.cache_status,
  };
}

export async function submitAnswer(
  sessionId: string,
  request: SubmitAnswerRequest | SubmitAnswerPayload,
): Promise<SubmitResult> {
  const body =
    'answer' in request
      ? request
      : {
          answer: request,
        };
  const response = await apiFetch<ApiSchemas['SubmitAnswerResponse']>(
    `/api/adaptive/session/${sessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return normalizeSubmitResult(response);
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  return apiFetch<ApiSchemas['SessionStatusResponse']>(
    `/api/adaptive/session/${sessionId}/status`,
    {
      cacheTtlMs: 10_000,
    },
  );
}

export async function getKnowledgeGraph(sessionId: string): Promise<KnowledgeGraphData> {
  const response = await apiFetch<ApiSchemas['KnowledgeGraphResponse']>(
    `/api/adaptive/session/${sessionId}/graph`,
    {
      cacheTtlMs: 10_000,
    },
  );
  return normalizeKnowledgeGraph(response);
}

export async function getMasteryMatrix(sessionId: string): Promise<MasteryMatrixData> {
  return apiFetch<ApiSchemas['MasteryMatrixResponse']>(
    `/api/adaptive/session/${sessionId}/mastery-matrix`,
    {
      cacheTtlMs: 10_000,
    },
  );
}

export async function getConceptDetail(
  sessionId: string,
  conceptId: string,
): Promise<ConceptDetail> {
  const response = await apiFetch<ApiSchemas['ConceptDetailResponse']>(
    `/api/adaptive/session/${sessionId}/concept/${conceptId}`,
    {
      cacheTtlMs: 10_000,
    },
  );
  return normalizeConceptDetail(response);
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const health = await apiFetch<ReadinessResponse>('/api/adaptive/health', { cache: 'no-store' });
    return health.ready;
  } catch {
    return false;
  }
}

// --- Pipeline API ---

export async function uploadPdf(
  file: File,
  subjectId?: string,
  pageBatchSize: number = DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
): Promise<PipelineUploadResponse> {
  // 1. Get presigned URL
  const { uploadUrl, s3Key } = await executeRequest<PresignedUploadUrlResponseDto>(
    '/api/storage/presigned-url',
    'POST',
    {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        fileSize: file.size,
        purpose: 'adaptive',
      }),
      timeoutMs: PRESIGNED_URL_TIMEOUT_MS,
    },
  );

  if (!uploadUrl || !s3Key) {
    throw invalidAdaptiveEnvelope('Invalid presigned URL response', 'storage presigned URL');
  }

  // 2. Upload to S3
  const uploadRes = await timedFetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/pdf',
    },
    body: file,
    timeoutMs: OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  });

  if (!uploadRes.ok) {
    throw new AdaptiveApiError({
      message: 'Failed to upload file to S3',
      code: 'upstream_error',
      status: uploadRes.status,
      retryable: uploadRes.status >= 500,
    });
  }

  // 3. Process the file
  return executeRequest<PipelineUploadResponse>('/api/adaptive/pipeline/process', 'POST', {
    body: JSON.stringify({
      s3Key,
      filename: file.name,
      subject_id: subjectId,
      page_batch_size: pageBatchSize,
    }),
    timeoutMs: PIPELINE_PROCESS_TIMEOUT_MS,
  });
}

export async function getPipelineJobStatus(jobId: string): Promise<PipelineJobStatus> {
  return apiFetch<PipelineJobStatus>(`/api/adaptive/pipeline/jobs/${jobId}`, {
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}

export async function createSessionFromPipeline(
  jobId: string,
  maxSteps: number = 9999,
): Promise<PipelineSessionResponse> {
  return apiFetch<PipelineSessionResponse>(
    `/api/adaptive/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
    { method: 'POST', timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS },
  );
}

// --- MongoDB History API ---

export async function getSubjectProgressHistory(limit = 50): Promise<SubjectProgressItem[]> {
  const res = await apiFetch<ApiSchemas['SubjectProgressListResponse']>(
    `/api/adaptive/history/subjects/progress?limit=${limit}`,
    { cacheTtlMs: 15_000 },
  );
  return res.subjects.map(toSubjectProgressItem);
}

export async function getSubjectHistoryDetail(jobId: string): Promise<SubjectHistoryDetail> {
  const detail = await apiFetch<ApiSchemas['SubjectHistoryDetailResponse']>(
    `/api/adaptive/history/subjects/${jobId}`,
    {
      cacheTtlMs: 30_000,
    },
  );
  return normalizeSubjectHistoryDetail(detail);
}

export async function getSubjectHistoryDetailFresh(jobId: string): Promise<SubjectHistoryDetail> {
  const detail = await executeRequest<ApiSchemas['SubjectHistoryDetailResponse']>(
    `/api/adaptive/history/subjects/${jobId}`,
    'GET',
    {
      cache: 'no-store',
    },
  );
  return normalizeSubjectHistoryDetail(detail);
}

export async function prefetchStartLearningData(sessionId: string): Promise<void> {
  await Promise.allSettled([getSessionStatus(sessionId), getLearningStep(sessionId)]);
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<ApiSchemas['SubjectHistoryListResponse']>('/api/adaptive/subjects', {
    cacheTtlMs: 10_000,
  });
  return res.subjects.map(toPipelineJobHistoryItem);
}

export async function getSubjectsFresh(): Promise<PipelineJobHistoryItem[]> {
  const res = await executeRequest<ApiSchemas['SubjectHistoryListResponse']>(
    '/api/adaptive/subjects',
    'GET',
    {
      cache: 'no-store',
    },
  );
  return res.subjects.map(toPipelineJobHistoryItem);
}

export async function deleteSubject(
  jobId: string,
  deleteSessions: boolean = true,
): Promise<DeleteSubjectResponse> {
  return apiFetch<DeleteSubjectResponse>(
    `/api/adaptive/history/subjects/${jobId}?delete_sessions=${deleteSessions ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}

export async function listPipelineJobs(limit = 50): Promise<PipelineJobListItem[]> {
  const res = await apiFetch<ApiSchemas['PipelineJobListResponse']>(
    `/api/adaptive/pipeline/jobs?limit=${limit}`,
    { timeoutMs: PIPELINE_STATUS_TIMEOUT_MS, cache: 'no-store' },
  );
  if (res.jobs) return res.jobs;
  if (res.count === 0) return [];
  throw invalidAdaptiveEnvelope(
    'Pipeline job list omitted jobs despite a non-zero count',
    'pipeline job list',
  );
}

export async function retryPipelineJob(jobId: string): Promise<PipelineJobRetryResponse> {
  return apiFetch(`/api/adaptive/pipeline/jobs/${jobId}/retry`, {
    method: 'POST',
    timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  });
}

export async function cancelPipelineJob(jobId: string): Promise<PipelineJobCancelResponse> {
  return apiFetch(`/api/adaptive/pipeline/jobs/${jobId}/cancel`, {
    method: 'POST',
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}
