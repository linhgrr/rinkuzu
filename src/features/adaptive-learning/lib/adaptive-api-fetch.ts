import { AdaptiveApiError } from './adaptive-api-error';

const API_BASE = '';
const DEFAULT_TIMEOUT_MS = 60_000;

type TimedFetchOptions = RequestInit & {
  timeoutMs?: number;
};

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  dedupeKey?: string;
  cacheTtlMs?: number;
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

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();

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

const PRESIGNED_URL_TIMEOUT_MS = 30_000;
const OBJECT_STORAGE_UPLOAD_TIMEOUT_MS = 180_000;
const PIPELINE_PROCESS_TIMEOUT_MS = 180_000;
const PIPELINE_STATUS_TIMEOUT_MS = 25_000;
const PIPELINE_CREATE_SESSION_TIMEOUT_MS = 30_000;
const DEFAULT_PIPELINE_PAGE_BATCH_SIZE = 10;

export {
  timedFetch,
  executeRequest,
  apiFetch,
  PRESIGNED_URL_TIMEOUT_MS,
  OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  PIPELINE_PROCESS_TIMEOUT_MS,
  PIPELINE_STATUS_TIMEOUT_MS,
  PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
};
