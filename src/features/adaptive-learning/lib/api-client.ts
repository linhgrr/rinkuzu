import {
  Session,
  Exercise,
  SubmitAnswerPayload,
  SubmitResult,
  SessionStatus,
  KnowledgeGraphData,
  MasteryMatrixData,
  ConceptDetail,
  PipelineUploadResponse,
  PipelineJobStatus,
  PipelineSessionResponse,
  SubjectProgressItem,
  SubjectHistoryDetail,
  PipelineJobHistoryItem,
  DeleteSubjectResponse,
  NextConcept,
  TheoryData,
} from '@/features/adaptive-learning/types';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PIPELINE_PAGE_BATCH_SIZE = 10;
const PRESIGNED_URL_TIMEOUT_MS = 30_000;
const OBJECT_STORAGE_UPLOAD_TIMEOUT_MS = 180_000;
const PIPELINE_PROCESS_TIMEOUT_MS = 180_000;
const PIPELINE_STATUS_TIMEOUT_MS = 25_000;
const PIPELINE_CREATE_SESSION_TIMEOUT_MS = 30_000;
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();

export class AdaptiveApiError extends Error {
  status?: number;
  detail?: string;
  code: string;
  retryable: boolean;

  constructor({
    message,
    code,
    status,
    detail,
    retryable = false,
  }: {
    message: string;
    code: string;
    status?: number;
    detail?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'AdaptiveApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.retryable = retryable;
  }
}

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  dedupeKey?: string;
  cacheTtlMs?: number;
};

type TimedFetchOptions = RequestInit & {
  timeoutMs?: number;
};

type StandardSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown> | null;
};

type StandardErrorDetail = {
  code?: string;
  message?: string;
  detail?: string;
  meta?: unknown;
};

type StandardErrorResponse = {
  success?: false;
  error?: string | StandardErrorDetail;
  detail?: string;
  message?: string;
};

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function normalizeNetworkFailure(error: unknown): AdaptiveApiError {
  if (isAbortLikeError(error)) {
    return new AdaptiveApiError({
      message: 'Request timed out or was interrupted',
      code: 'request_aborted',
      retryable: true,
    });
  }

  if (error instanceof Error) {
    return new AdaptiveApiError({
      message: error.message || 'Network request failed',
      code: 'network_error',
      detail: error.message,
      retryable: true,
    });
  }

  return new AdaptiveApiError({
    message: 'Network request failed',
    code: 'network_error',
    retryable: true,
  });
}

function looksLikeHtmlPayload(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.includes('<head>') ||
    normalized.includes('<body>')
  );
}

function normalizeAdaptiveError(status: number, detail: string): AdaptiveApiError {
  const trimmedDetail = detail.trim();

  if (looksLikeHtmlPayload(trimmedDetail)) {
    return new AdaptiveApiError({
      message: 'Adaptive service temporarily unavailable',
      code: 'upstream_html_error',
      status,
      detail: 'upstream_html_error',
      retryable: true,
    });
  }

  if (status === 400 && /not completed/i.test(trimmedDetail)) {
    return new AdaptiveApiError({
      message: trimmedDetail || 'Processing is not ready yet',
      code: 'pipeline_not_ready',
      status,
      detail: trimmedDetail,
      retryable: true,
    });
  }

  if (status === 401) {
    return new AdaptiveApiError({
      message: 'Unauthorized',
      code: 'unauthorized',
      status,
      detail: trimmedDetail,
    });
  }

  if (status === 404) {
    return new AdaptiveApiError({
      message: 'Requested resource was not found',
      code: 'not_found',
      status,
      detail: trimmedDetail,
    });
  }

  if (status === 409) {
    return new AdaptiveApiError({
      message: trimmedDetail || 'Resource state conflict',
      code: 'conflict',
      status,
      detail: trimmedDetail,
    });
  }

  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return new AdaptiveApiError({
      message: trimmedDetail || 'Adaptive service temporarily unavailable',
      code: 'temporary_unavailable',
      status,
      detail: trimmedDetail,
      retryable: true,
    });
  }

  return new AdaptiveApiError({
    message: trimmedDetail || `API Error ${status}`,
    code: 'request_failed',
    status,
    detail: trimmedDetail,
  });
}

function parseJsonText(rawText: string): unknown | null {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

async function parseResponseBody(res: Response): Promise<{ payload: unknown; rawText: string }> {
  const rawText = await res.text().catch(() => '');
  return {
    payload: parseJsonText(rawText),
    rawText,
  };
}

function extractAdaptiveErrorDetail(payload: unknown, rawText: string): string {
  if (payload && typeof payload === 'object') {
    const errorPayload = payload as StandardErrorResponse;
    const error = errorPayload.error;

    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }

    if (error && typeof error === 'object') {
      const detail = typeof error.detail === 'string' ? error.detail.trim() : '';
      const message = typeof error.message === 'string' ? error.message.trim() : '';
      const code = typeof error.code === 'string' ? error.code.trim() : '';

      if (detail) return detail;
      if (message) return message;
      if (code) return code;
    }

    const detail = typeof errorPayload.detail === 'string' ? errorPayload.detail.trim() : '';
    const message = typeof errorPayload.message === 'string' ? errorPayload.message.trim() : '';

    if (detail) return detail;
    if (message) return message;
  }

  return rawText.trim();
}

function unwrapStandardSuccess<T>(
  payload: unknown,
): { matched: true; data: T } | { matched: false } {
  if (
    payload &&
    typeof payload === 'object' &&
    (payload as StandardSuccessResponse<T> | StandardErrorResponse).success === true &&
    'data' in payload
  ) {
    return {
      matched: true,
      data: (payload as StandardSuccessResponse<T>).data,
    };
  }

  return { matched: false };
}

async function timedFetch(url: string, options?: TimedFetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    throw normalizeNetworkFailure(error);
  } finally {
    clearTimeout(timeout);
  }
}

export function isRetryableAdaptiveError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError && error.retryable;
}

export function isAdaptiveApiError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError;
}

function readCachedResponse<T>(key: string): T | null {
  const hit = responseCache.get(key);
  if (!hit) {
    return null;
  }

  if (Date.now() >= hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return hit.data as T;
}

function writeCachedResponse<T>(key: string, data: T, ttlMs?: number): void {
  if (!ttlMs || ttlMs <= 0) {
    return;
  }

  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function invalidateCacheByPrefixes(prefixes: string[]): void {
  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }
}

async function executeRequest<T>(
  path: string,
  method: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const headers = new Headers(options?.headers);
  const body = options?.body;
  const shouldAttachJsonContentType =
    body !== undefined &&
    body !== null &&
    !(body instanceof FormData) &&
    !headers.has('Content-Type');

  if (shouldAttachJsonContentType) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await timedFetch(`${API_BASE}${path}`, {
    ...options,
    method,
    cache: options?.cache ?? 'no-store',
    headers,
    timeoutMs: options?.timeoutMs,
  });

  if (!res.ok) {
    const { payload, rawText } = await parseResponseBody(res);
    const detail = extractAdaptiveErrorDetail(payload, rawText) || res.statusText;
    throw normalizeAdaptiveError(res.status, detail);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const { payload, rawText } = await parseResponseBody(res);
  const unwrapped = unwrapStandardSuccess<T>(payload);

  if (unwrapped.matched) {
    return unwrapped.data;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    (payload as StandardErrorResponse).success === false
  ) {
    const detail = extractAdaptiveErrorDetail(payload, rawText) || res.statusText;
    throw normalizeAdaptiveError(res.status, detail);
  }

  if (payload !== null) {
    return payload as T;
  }

  throw new AdaptiveApiError({
    message: 'Adaptive service returned an unexpected response',
    code: 'invalid_response',
    status: res.status,
    detail: rawText || undefined,
    retryable: true,
  });
}

async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const dedupeKey = options?.dedupeKey || path;

  if (!isGet) {
    // Writes can affect several derived reads in adaptive dashboards.
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      invalidateCacheByPrefixes([
        '/api/adaptive-learning/session/',
        '/api/adaptive-learning/history/',
        '/api/adaptive-learning/subjects',
      ]);
    }
    return executeRequest<T>(path, method, options);
  }

  const cached = readCachedResponse<T>(dedupeKey);
  if (cached !== null) {
    return cached;
  }

  const inFlight = inFlightGetRequests.get(dedupeKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const requestPromise = executeRequest<T>(path, method, options)
    .then((data) => {
      writeCachedResponse(dedupeKey, data, options?.cacheTtlMs);
      return data;
    })
    .finally(() => inFlightGetRequests.delete(dedupeKey));

  inFlightGetRequests.set(dedupeKey, requestPromise as Promise<unknown>);
  return requestPromise;
}

export async function createSession(maxSteps: number = 9999): Promise<Session> {
  return apiFetch<Session>('/api/adaptive-learning/session/start', {
    method: 'POST',
    body: JSON.stringify({ max_steps: maxSteps, use_default_data: true }),
  });
}

export async function getNextConcept(sessionId: string): Promise<NextConcept> {
  return apiFetch<NextConcept>(`/api/adaptive-learning/session/${sessionId}/next-concept`, {
    method: 'POST',
  });
}

export async function getTheory(sessionId: string): Promise<TheoryData> {
  return apiFetch<TheoryData>(`/api/adaptive-learning/session/${sessionId}/theory`, {
    method: 'GET',
  });
}

export async function getExercise(sessionId: string): Promise<Exercise> {
  return apiFetch<Exercise>(`/api/adaptive-learning/session/${sessionId}/exercise`, {
    method: 'POST',
  });
}

export async function submitAnswer(
  sessionId: string,
  answer: SubmitAnswerPayload,
): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/api/adaptive-learning/session/${sessionId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

export async function getSessionStatus(sessionId: string): Promise<SessionStatus> {
  return apiFetch<SessionStatus>(`/api/adaptive-learning/session/${sessionId}/status`, {
    cacheTtlMs: 10_000,
  });
}

export async function getKnowledgeGraph(sessionId: string): Promise<KnowledgeGraphData> {
  return apiFetch<KnowledgeGraphData>(`/api/adaptive-learning/session/${sessionId}/graph`, {
    cacheTtlMs: 10_000,
  });
}

export async function getMasteryMatrix(sessionId: string): Promise<MasteryMatrixData> {
  return apiFetch<MasteryMatrixData>(`/api/adaptive-learning/session/${sessionId}/mastery-matrix`, {
    cacheTtlMs: 10_000,
  });
}

export async function getConceptDetail(
  sessionId: string,
  conceptId: string,
): Promise<ConceptDetail> {
  return apiFetch<ConceptDetail>(
    `/api/adaptive-learning/session/${sessionId}/concept/${conceptId}`,
    {
      cacheTtlMs: 10_000,
    },
  );
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/adaptive-learning/health', { cache: 'no-store' });
    return res.ok;
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
  const presignedRes = await timedFetch('/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
      purpose: 'quiz',
    }),
    timeoutMs: PRESIGNED_URL_TIMEOUT_MS,
  });

  if (!presignedRes.ok) {
    throw new AdaptiveApiError({
      message: 'Failed to get upload URL',
      code: 'presigned_url_failed',
      status: presignedRes.status,
    });
  }

  const data = await presignedRes.json();
  const { uploadUrl, s3Key } = data.data || {};

  if (!uploadUrl || !s3Key) {
    throw new AdaptiveApiError({
      message: 'Invalid presigned url response',
      code: 'presigned_url_invalid',
      status: presignedRes.status,
    });
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
      code: 's3_upload_failed',
      status: uploadRes.status,
      retryable: uploadRes.status >= 500,
    });
  }

  // 3. Process the file
  return executeRequest<PipelineUploadResponse>('/api/adaptive-learning/pipeline/process', 'POST', {
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
  return apiFetch<PipelineJobStatus>(`/api/adaptive-learning/pipeline/jobs/${jobId}`, {
    timeoutMs: PIPELINE_STATUS_TIMEOUT_MS,
  });
}

export async function createSessionFromPipeline(
  jobId: string,
  maxSteps: number = 9999,
): Promise<PipelineSessionResponse> {
  return apiFetch<PipelineSessionResponse>(
    `/api/adaptive-learning/pipeline/jobs/${jobId}/create-session?max_steps=${maxSteps}`,
    { method: 'POST', timeoutMs: PIPELINE_CREATE_SESSION_TIMEOUT_MS },
  );
}

export async function checkPipelineAvailable(): Promise<boolean> {
  try {
    const res = await apiFetch<{ available: boolean }>('/api/adaptive-learning/pipeline/status');
    return res.available;
  } catch {
    return false;
  }
}

// --- MongoDB History API ---

export async function getSubjectProgressHistory(limit = 50): Promise<SubjectProgressItem[]> {
  const res = await apiFetch<{ subjects: SubjectProgressItem[]; count: number }>(
    `/api/adaptive-learning/history/subjects/progress?limit=${limit}`,
    { cacheTtlMs: 15_000 },
  );
  return res.subjects;
}

export async function getSubjectHistoryDetail(jobId: string): Promise<SubjectHistoryDetail> {
  return apiFetch<SubjectHistoryDetail>(`/api/adaptive-learning/history/subjects/${jobId}`, {
    cacheTtlMs: 30_000,
  });
}

export async function getSubjectHistoryDetailFresh(jobId: string): Promise<SubjectHistoryDetail> {
  return executeRequest<SubjectHistoryDetail>(
    `/api/adaptive-learning/history/subjects/${jobId}`,
    'GET',
    { cache: 'no-store' },
  );
}

export async function prefetchStartLearningData(sessionId: string): Promise<void> {
  await Promise.allSettled([getSessionStatus(sessionId)]);
}

export async function getPipelineJobHistory(limit = 20): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<{ jobs: PipelineJobHistoryItem[]; count: number }>(
    `/api/adaptive-learning/history/pipeline-jobs?limit=${limit}`,
    { cacheTtlMs: 10_000 },
  );
  return res.jobs;
}

/**
 * Get all completed subjects (pipeline jobs) from MongoDB.
 * Used by the Dashboard to show the "My Subjects" grid.
 */
export async function getSubjects(): Promise<PipelineJobHistoryItem[]> {
  const res = await apiFetch<
    { subjects: PipelineJobHistoryItem[]; count: number } | PipelineJobHistoryItem[]
  >('/api/adaptive-learning/subjects', { cacheTtlMs: 10_000 });
  return Array.isArray(res) ? res : res.subjects;
}

export async function deleteSubject(
  jobId: string,
  deleteSessions: boolean = true,
): Promise<DeleteSubjectResponse> {
  return apiFetch<DeleteSubjectResponse>(
    `/api/adaptive-learning/history/subjects/${jobId}?delete_sessions=${deleteSessions ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}

export function isSessionNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('session not found') || message.includes('session_not_found');
}
