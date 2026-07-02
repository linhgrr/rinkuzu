import { AdaptiveApiError } from './adaptive-api-error';
import { isStandardErrorEnvelope, isStandardSuccessEnvelope } from '@/lib/api/envelope';

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
      message: error.message || 'Service unavailable',
      code: 'service_unavailable',
      detail: error.message,
      retryable: true,
    });
  }

  return new AdaptiveApiError({
    message: 'Service unavailable',
    code: 'service_unavailable',
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

function normalizeAdaptiveError({
  status,
  code,
  message,
  detail,
}: {
  status: number;
  code?: string | null;
  message?: string | null;
  detail?: string | null;
}): AdaptiveApiError {
  const trimmedDetail = detail?.trim() ?? '';
  const trimmedMessage = message?.trim() ?? '';
  const normalizedCode = code?.trim() ?? '';

  if (looksLikeHtmlPayload(trimmedDetail)) {
    return new AdaptiveApiError({
      message: 'Adaptive service temporarily unavailable',
      code: 'upstream_error',
      status,
      detail: trimmedDetail || 'Upstream service returned HTML',
      retryable: true,
    });
  }

  if (
    normalizedCode === 'pipeline_not_completed' ||
    (status === 409 && /not completed/i.test(trimmedDetail))
  ) {
    return new AdaptiveApiError({
      message: trimmedMessage || 'Processing is not ready yet',
      code: 'pipeline_not_completed',
      status,
      detail: trimmedDetail || trimmedMessage,
      retryable: true,
    });
  }

  if (normalizedCode === 'unauthorized' || status === 401) {
    return new AdaptiveApiError({
      message: trimmedMessage || 'Unauthorized',
      code: 'unauthorized',
      status,
      detail: trimmedDetail,
    });
  }

  if (normalizedCode === 'not_found' || status === 404) {
    return new AdaptiveApiError({
      message: trimmedMessage || 'Requested resource was not found',
      code: 'not_found',
      status,
      detail: trimmedDetail,
    });
  }

  if (normalizedCode === 'conflict' || status === 409) {
    return new AdaptiveApiError({
      message: trimmedMessage || 'Resource state conflict',
      code: 'conflict',
      status,
      detail: trimmedDetail,
    });
  }

  if (
    normalizedCode === 'rate_limit_exceeded' ||
    normalizedCode === 'upstream_error' ||
    normalizedCode === 'upstream_html_error' ||
    normalizedCode === 'upstream_invalid_json' ||
    normalizedCode === 'upstream_invalid_envelope' ||
    normalizedCode === 'service_unavailable' ||
    normalizedCode === 'upstream_timeout' ||
    [429, 502, 503, 504].includes(status)
  ) {
    return new AdaptiveApiError({
      message: trimmedMessage || 'Adaptive service temporarily unavailable',
      code:
        (normalizedCode === 'upstream_html_error' ? 'upstream_error' : normalizedCode) ||
        (status === 502 ? 'upstream_error' : 'service_unavailable'),
      status,
      detail: trimmedDetail,
      retryable: true,
    });
  }

  return new AdaptiveApiError({
    message: trimmedMessage || trimmedDetail || `API Error ${status}`,
    code: normalizedCode || 'request_failed',
    status,
    detail: trimmedDetail || undefined,
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
    if (isStandardErrorEnvelope(payload)) {
      throw normalizeAdaptiveError({
        status: res.status,
        code: payload.error.code,
        message: payload.error.message,
        detail: payload.error.detail || payload.error.message,
      });
    }

    throw normalizeAdaptiveError({
      status: res.status,
      message: 'Request failed',
      detail: rawText || res.statusText,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const { payload, rawText } = await parseResponseBody(res);
  if (rawText && payload === null) {
    throw new AdaptiveApiError({
      message: looksLikeHtmlPayload(rawText)
        ? 'Adaptive service temporarily unavailable'
        : 'Adaptive service returned invalid JSON',
      code: looksLikeHtmlPayload(rawText) ? 'upstream_error' : 'upstream_invalid_json',
      status: res.status,
      detail: rawText,
      retryable: true,
    });
  }

  if (isStandardSuccessEnvelope<T>(payload)) {
    return payload.data;
  }

  throw new AdaptiveApiError({
    message: 'Adaptive service returned an invalid response envelope',
    code: 'upstream_invalid_envelope',
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
    if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
      invalidateCacheByPrefixes([
        '/api/adaptive/session/',
        '/api/adaptive/history/',
        '/api/adaptive/subjects',
        '/api/adaptive/pipeline/',
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
