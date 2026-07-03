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
  ExerciseType,
  SubmitAnswerPayload,
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
  toPipelineStatus,
  toSubjectProgressItem,
} from '@/features/adaptive/mappers/pipeline.mapper';

type ApiSchemas = components['schemas'];
type ExercisePair = { left: string; right: string };

const EXERCISE_TYPES: ReadonlySet<string> = new Set<ExerciseType>([
  'mcq',
  'true_false',
  'fill_blank',
  'multi_correct',
  'ordering',
  'matching',
  'short_answer',
]);

const OPTION_EXERCISE_TYPES: ReadonlySet<ExerciseType> = new Set<ExerciseType>([
  'mcq',
  'true_false',
  'multi_correct',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];
  if (typeof value === 'string') return value;
  throw new AdaptiveApiError({
    message: `Invalid adaptive response field: ${key}`,
    code: 'upstream_invalid_envelope',
    detail: context,
    retryable: true,
  });
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

function readNullableBoolean(
  record: Record<string, unknown>,
  key: string,
  context: string,
): boolean | null {
  const value = record[key];
  if (typeof value === 'boolean' || value === null) return value;
  throw new AdaptiveApiError({
    message: `Invalid adaptive response field: ${key}`,
    code: 'upstream_invalid_envelope',
    detail: context,
    retryable: true,
  });
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string | null {
  const value = record[key];
  if (typeof value === 'string' || value === null) return value;
  throw new AdaptiveApiError({
    message: `Invalid adaptive response field: ${key}`,
    code: 'upstream_invalid_envelope',
    detail: context,
    retryable: true,
  });
}

function readOptionalNullableString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string | null | undefined {
  return key in record ? readNullableString(record, key, context) : undefined;
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string[] | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw invalidAdaptiveEnvelope(`Invalid adaptive response field: ${key}`, context);
}

function readOptionalStringRecord(
  record: Record<string, unknown>,
  key: string,
  context: string,
): Record<string, string> | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (isRecord(value) && Object.values(value).every((item) => typeof item === 'string')) {
    return value as Record<string, string>;
  }
  throw invalidAdaptiveEnvelope(`Invalid adaptive response field: ${key}`, context);
}

function readOptionalPairs(
  record: Record<string, unknown>,
  key: string,
  context: string,
): ExercisePair[] | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) && typeof item['left'] === 'string' && typeof item['right'] === 'string',
    )
  ) {
    return value.map((item) => {
      const pair = item as ExercisePair;
      return { left: pair.left, right: pair.right };
    });
  }
  throw invalidAdaptiveEnvelope(`Invalid adaptive response field: ${key}`, context);
}

function readOptionalCorrectAnswer(
  record: Record<string, unknown>,
  context: string,
): ExerciseHistoryFull['correct_answer'] {
  const value = record['correct_answer'];
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string')) ||
    (isRecord(value) && Object.values(value).every((item) => typeof item === 'string'))
  ) {
    return value as ExerciseHistoryFull['correct_answer'];
  }
  throw invalidAdaptiveEnvelope('Invalid adaptive response field: correct_answer', context);
}

function normalizeExerciseOptions(
  options: Record<string, string> | undefined,
  exerciseType: ExerciseType,
  context: string,
): Record<string, string> {
  if (options) return options;
  if (OPTION_EXERCISE_TYPES.has(exerciseType)) {
    throw invalidAdaptiveEnvelope(`Missing options for ${exerciseType} exercise`, context);
  }
  return {};
}

function normalizeExerciseItems(
  items: string[] | undefined,
  exerciseType: ExerciseType,
  context: string,
): string[] {
  if (items) return items;
  if (exerciseType === 'ordering') {
    throw invalidAdaptiveEnvelope('Missing items for ordering exercise', context);
  }
  return [];
}

function normalizeExercisePairs(
  pairs: ExercisePair[] | undefined,
  exerciseType: ExerciseType,
  context: string,
): ExercisePair[] {
  if (pairs) return pairs;
  if (exerciseType === 'matching') {
    throw invalidAdaptiveEnvelope('Missing pairs for matching exercise', context);
  }
  return [];
}

function normalizeExerciseResponse(response: ApiSchemas['ExerciseResponse']): Exercise {
  const context = `exercise ${response.exercise_id}`;
  const raw = response as ApiSchemas['ExerciseResponse'] & Record<string, unknown>;
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

  return {
    ...response,
    id: response.exercise_id,
    bloom_level: normalizeBloomLevel(response.bloom_level, context),
    bloom_label: normalizeBloomLabel(response.bloom_label, context),
    exercise_type: exerciseType,
    options: normalizeExerciseOptions(
      readOptionalStringRecord(raw, 'options', context),
      exerciseType,
      context,
    ),
    items: normalizeExerciseItems(
      readOptionalStringArray(raw, 'items', context),
      exerciseType,
      context,
    ),
    pairs: normalizeExercisePairs(readOptionalPairs(raw, 'pairs', context), exerciseType, context),
    right_items: readOptionalStringArray(raw, 'right_items', context) ?? [],
    recommendation_reason: recommendationReason,
  };
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
  item: Record<string, unknown>,
  index: number,
): ExerciseHistoryFull {
  const context = `subject exercise_history[${index}]`;
  const exerciseType = normalizeExerciseType(readString(item, 'exercise_type', context), context);

  return {
    exercise_id: readString(item, 'exercise_id', context),
    concept_idx: readNumber(item, 'concept_idx', context),
    concept_name: readString(item, 'concept_name', context),
    bloom_level: normalizeBloomLevel(readNumber(item, 'bloom_level', context), context),
    question: readString(item, 'question', context),
    sentence: readOptionalNullableString(item, 'sentence', context),
    exercise_type: exerciseType,
    options: normalizeExerciseOptions(
      readOptionalStringRecord(item, 'options', context),
      exerciseType,
      context,
    ),
    statement: readOptionalNullableString(item, 'statement', context),
    hint: readOptionalNullableString(item, 'hint', context),
    items: normalizeExerciseItems(
      readOptionalStringArray(item, 'items', context),
      exerciseType,
      context,
    ),
    pairs: normalizeExercisePairs(readOptionalPairs(item, 'pairs', context), exerciseType, context),
    right_items: readOptionalStringArray(item, 'right_items', context) ?? [],
    rubric: readOptionalStringArray(item, 'rubric', context),
    correct_answer: readOptionalCorrectAnswer(item, context),
    correct_option: readString(item, 'correct_option', context),
    explanation: readString(item, 'explanation', context),
    user_answer: readNullableString(item, 'user_answer', context),
    is_correct: readNullableBoolean(item, 'is_correct', context),
    timestamp: readNumber(item, 'timestamp', context),
  };
}

function normalizeExerciseHistory(
  exerciseHistory: ApiSchemas['SubjectHistoryDetailResponse']['exercise_history'],
): ExerciseHistoryFull[] {
  return exerciseHistory.map((item, index) => {
    if (!isRecord(item)) {
      throw new AdaptiveApiError({
        message: 'Invalid adaptive history item',
        code: 'upstream_invalid_envelope',
        detail: `subject exercise_history[${index}]`,
        retryable: true,
      });
    }
    return normalizeExerciseHistoryItem(item, index);
  });
}

function normalizeSubjectHistoryDetail(
  detail: ApiSchemas['SubjectHistoryDetailResponse'],
): SubjectHistoryDetail {
  return {
    ...detail,
    status: toPipelineStatus(detail.status, `subject history detail ${detail.job_id}`),
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
  const response = await apiFetch<ApiSchemas['ExerciseResponse']>(
    `/api/adaptive/session/${sessionId}/exercise`,
    {
      method: 'POST',
    },
  );
  return normalizeExerciseResponse(response);
}

export async function submitAnswer(
  sessionId: string,
  answer: SubmitAnswerPayload,
): Promise<SubmitResult> {
  const response = await apiFetch<ApiSchemas['SubmitAnswerResponse']>(
    `/api/adaptive/session/${sessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ answer }),
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
        purpose: 'quiz',
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
  await Promise.allSettled([getSessionStatus(sessionId)]);
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<ApiSchemas['SubjectHistoryResponse'][]>('/api/adaptive/subjects', {
    cacheTtlMs: 10_000,
  });
  return res.map(toPipelineJobHistoryItem);
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
