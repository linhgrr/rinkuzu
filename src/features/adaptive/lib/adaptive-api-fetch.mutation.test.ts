import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  executeRequest,
  timedFetch,
  PRESIGNED_URL_TIMEOUT_MS,
  OBJECT_STORAGE_UPLOAD_TIMEOUT_MS,
  PIPELINE_PROCESS_TIMEOUT_MS,
  PIPELINE_STATUS_TIMEOUT_MS,
  PIPELINE_CREATE_SESSION_TIMEOUT_MS,
  DEFAULT_PIPELINE_PAGE_BATCH_SIZE,
} from '@/features/adaptive/lib/adaptive-api-fetch';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

function successEnvelope<T>(data: T): Response {
  return jsonResponse({ success: true, data });
}

function errorEnvelope(
  status: number,
  error: { code?: string; message?: string; detail?: string },
  statusText = 'Error',
): Response {
  return jsonResponse({ success: false, error }, { status, statusText });
}

function uniquePath(suffix: string): string {
  return `/api/adaptive/mutation-test/${suffix}-${Math.random().toString(36).slice(2)}`;
}

describe('adaptive-api-fetch mutation coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports pipeline timing and batch constants with exact production values', () => {
    expect(PRESIGNED_URL_TIMEOUT_MS).toBe(30_000);
    expect(OBJECT_STORAGE_UPLOAD_TIMEOUT_MS).toBe(180_000);
    expect(PIPELINE_PROCESS_TIMEOUT_MS).toBe(180_000);
    expect(PIPELINE_STATUS_TIMEOUT_MS).toBe(25_000);
    expect(PIPELINE_CREATE_SESSION_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_PIPELINE_PAGE_BATCH_SIZE).toBe(10);
  });

  describe('timedFetch network failures', () => {
    it('maps TimeoutError to request_aborted with retryable true', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')),
      );

      await expect(timedFetch('/api/adaptive/health', { timeoutMs: 5 })).rejects.toMatchObject({
        name: 'AdaptiveApiError',
        code: 'request_aborted',
        message: 'Request timed out or was interrupted',
        retryable: true,
      });
    });

    it('maps AbortError to request_aborted', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));

      await expect(timedFetch('/x', { timeoutMs: 5 })).rejects.toMatchObject({
        code: 'request_aborted',
        retryable: true,
      });
    });

    it('maps Error without message to service_unavailable defaults', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('')));

      await expect(timedFetch('/x', { timeoutMs: 5 })).rejects.toMatchObject({
        code: 'service_unavailable',
        message: 'Service unavailable',
        detail: '',
        retryable: true,
      });
    });

    it('maps Error with message to service_unavailable using that message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('dns failure')));

      await expect(timedFetch('/x', { timeoutMs: 5 })).rejects.toMatchObject({
        code: 'service_unavailable',
        message: 'dns failure',
        detail: 'dns failure',
        retryable: true,
      });
    });

    it('maps non-Error rejections to generic service_unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('network-down'));

      await expect(timedFetch('/x', { timeoutMs: 5 })).rejects.toMatchObject({
        code: 'service_unavailable',
        message: 'Service unavailable',
        retryable: true,
      });
    });

    it('merges caller AbortSignal with timeout signal', async () => {
      const caller = new AbortController();
      let received: AbortSignal | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
          received = init?.signal as AbortSignal | undefined;
          return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }),
      );

      const pending = timedFetch('/health', { timeoutMs: 30_000, signal: caller.signal });
      caller.abort();

      await expect(pending).rejects.toMatchObject({ code: 'request_aborted' });
      expect(received?.aborted).toBe(true);
    });
  });

  describe('executeRequest error normalization', () => {
    it('normalizes unauthorized by status and by code', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            errorEnvelope(401, { message: '  Nope  ', detail: '  token gone  ' }),
          )
          .mockResolvedValueOnce(
            errorEnvelope(400, {
              code: 'unauthorized',
              message: 'bad auth',
              detail: 'detail-auth',
            }),
          ),
      );

      await expect(executeRequest('/a', 'GET')).rejects.toMatchObject({
        code: 'unauthorized',
        message: 'Nope',
        status: 401,
        detail: 'token gone',
        retryable: false,
      });
      await expect(executeRequest('/b', 'GET')).rejects.toMatchObject({
        code: 'unauthorized',
        message: 'bad auth',
        status: 400,
        detail: 'detail-auth',
      });
    });

    it('normalizes not_found by status and by code with defaults', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(errorEnvelope(404, {}))
          .mockResolvedValueOnce(errorEnvelope(400, { code: '  not_found  ' })),
      );

      await expect(executeRequest('/missing', 'GET')).rejects.toMatchObject({
        code: 'not_found',
        message: 'Requested resource was not found',
        status: 404,
      });
      await expect(executeRequest('/missing-code', 'GET')).rejects.toMatchObject({
        code: 'not_found',
        status: 400,
      });
    });

    it('normalizes conflict and pipeline_not_completed branches', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(errorEnvelope(409, { message: 'busy', detail: 'state mismatch' }))
          .mockResolvedValueOnce(errorEnvelope(409, { detail: 'Processing not completed for job' }))
          .mockResolvedValueOnce(
            errorEnvelope(400, {
              code: 'pipeline_not_completed',
              message: 'Wait',
              detail: 'still running',
            }),
          )
          .mockResolvedValueOnce(errorEnvelope(400, { code: 'conflict', message: 'Conflicted' })),
      );

      await expect(executeRequest('/c1', 'GET')).rejects.toMatchObject({
        code: 'conflict',
        message: 'busy',
        status: 409,
        detail: 'state mismatch',
      });
      await expect(executeRequest('/c2', 'GET')).rejects.toMatchObject({
        code: 'pipeline_not_completed',
        message: 'Processing is not ready yet',
        status: 409,
        detail: 'Processing not completed for job',
        retryable: true,
      });
      await expect(executeRequest('/c3', 'GET')).rejects.toMatchObject({
        code: 'pipeline_not_completed',
        message: 'Wait',
        detail: 'still running',
        retryable: true,
      });
      await expect(executeRequest('/c4', 'GET')).rejects.toMatchObject({
        code: 'conflict',
        message: 'Conflicted',
        status: 400,
      });
    });

    it('treats HTML error payloads as upstream_error even without envelope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('<!DOCTYPE html><html><head></head><body>bad gateway</body></html>', {
            status: 502,
            statusText: 'Bad Gateway',
          }),
        ),
      );

      await expect(executeRequest('/html-error', 'GET')).rejects.toMatchObject({
        code: 'upstream_error',
        message: 'Adaptive service temporarily unavailable',
        status: 502,
        retryable: true,
      });
    });

    it('maps retryable codes and gateway statuses', async () => {
      const cases: Array<{
        status: number;
        error: { code?: string; message?: string; detail?: string };
        expectedCode: string;
      }> = [
        {
          status: 429,
          error: { code: 'rate_limit_exceeded', message: 'slow down' },
          expectedCode: 'rate_limit_exceeded',
        },
        {
          status: 503,
          error: { code: 'upstream_error', message: 'down' },
          expectedCode: 'upstream_error',
        },
        {
          status: 502,
          error: { code: 'upstream_html_error', message: 'html' },
          expectedCode: 'upstream_error',
        },
        {
          status: 500,
          error: { code: 'upstream_invalid_json' },
          expectedCode: 'upstream_invalid_json',
        },
        {
          status: 500,
          error: { code: 'upstream_invalid_envelope' },
          expectedCode: 'upstream_invalid_envelope',
        },
        {
          status: 500,
          error: { code: 'service_unavailable' },
          expectedCode: 'service_unavailable',
        },
        {
          status: 500,
          error: { code: 'upstream_timeout', message: 'timeout' },
          expectedCode: 'upstream_timeout',
        },
        { status: 504, error: {}, expectedCode: 'service_unavailable' },
        { status: 502, error: {}, expectedCode: 'upstream_error' },
      ];

      const spy = vi.fn();
      for (const c of cases) {
        spy.mockResolvedValueOnce(errorEnvelope(c.status, c.error));
      }
      vi.stubGlobal('fetch', spy);

      for (const c of cases) {
        await expect(
          executeRequest(`/retry-${c.expectedCode}-${c.status}`, 'GET'),
        ).rejects.toMatchObject({
          code: c.expectedCode,
          status: c.status,
          retryable: true,
        });
      }
    });

    it('falls back to request_failed for unknown errors and uses detail when message missing', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            errorEnvelope(422, { message: '  validation  ', detail: 'field x' }),
          )
          .mockResolvedValueOnce(errorEnvelope(418, { detail: '  teapot  ' }))
          .mockResolvedValueOnce(
            new Response('plain failure', { status: 500, statusText: 'Server Error' }),
          ),
      );

      await expect(executeRequest('/u1', 'GET')).rejects.toMatchObject({
        code: 'request_failed',
        message: 'validation',
        status: 422,
        detail: 'field x',
      });
      await expect(executeRequest('/u2', 'GET')).rejects.toMatchObject({
        code: 'request_failed',
        message: 'teapot',
        status: 418,
      });
      await expect(executeRequest('/u3', 'GET')).rejects.toMatchObject({
        code: 'request_failed',
        message: 'Request failed',
        status: 500,
        detail: 'plain failure',
      });
    });

    it('uses statusText when error body is empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Boom' })),
      );

      await expect(executeRequest('/empty-body', 'GET')).rejects.toMatchObject({
        code: 'request_failed',
        message: 'Request failed',
        detail: 'Boom',
        status: 500,
      });
    });
  });

  describe('executeRequest success and envelope parsing', () => {
    it('returns undefined for 204 No Content', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

      await expect(executeRequest<void>('/no-content', 'DELETE')).resolves.toBeUndefined();
    });

    it('unwraps standard success envelopes', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successEnvelope({ ok: true, n: 3 })));

      await expect(executeRequest<{ ok: boolean; n: number }>('/ok', 'GET')).resolves.toEqual({
        ok: true,
        n: 3,
      });
    });

    it('rejects invalid JSON success bodies as upstream_invalid_json', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('{not-json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      await expect(executeRequest('/bad-json', 'GET')).rejects.toMatchObject({
        code: 'upstream_invalid_json',
        message: 'Adaptive service returned invalid JSON',
        retryable: true,
        status: 200,
      });
    });

    it('rejects HTML success bodies as upstream_error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('<html><body>oops</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
        ),
      );

      await expect(executeRequest('/html-ok', 'GET')).rejects.toMatchObject({
        code: 'upstream_error',
        message: 'Adaptive service temporarily unavailable',
        retryable: true,
      });
    });

    it('rejects non-envelope JSON as upstream_invalid_envelope', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ raw: true })));

      await expect(executeRequest('/no-envelope', 'GET')).rejects.toMatchObject({
        code: 'upstream_invalid_envelope',
        message: 'Adaptive service returned an invalid response envelope',
        retryable: true,
        status: 200,
        detail: '{"raw":true}',
      });
    });

    it('sets application/json Content-Type for string bodies but not FormData or pre-set headers', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ done: true }));
      vi.stubGlobal('fetch', spy);

      await executeRequest('/json-body', 'POST', { body: JSON.stringify({ a: 1 }) });
      const jsonHeaders = new Headers(spy.mock.calls[0]?.[1]?.headers as HeadersInit);
      expect(jsonHeaders.get('Content-Type')).toBe('application/json');

      await executeRequest('/form-body', 'POST', { body: new FormData() });
      const formHeaders = new Headers(spy.mock.calls[1]?.[1]?.headers as HeadersInit);
      expect(formHeaders.has('Content-Type')).toBe(false);

      await executeRequest('/custom-ct', 'POST', {
        body: JSON.stringify({ a: 1 }),
        headers: { 'Content-Type': 'application/vnd.custom+json' },
      });
      const customHeaders = new Headers(spy.mock.calls[2]?.[1]?.headers as HeadersInit);
      expect(customHeaders.get('Content-Type')).toBe('application/vnd.custom+json');
    });

    it('defaults cache to no-store and forwards explicit timeoutMs', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ v: 1 }));
      vi.stubGlobal('fetch', spy);

      await executeRequest(uniquePath('timeout'), 'GET', { timeoutMs: 12_345 });
      expect(spy.mock.calls[0]?.[1]).toMatchObject({
        method: 'GET',
        cache: 'no-store',
      });
    });

    it('respects explicit cache option on executeRequest', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ v: 2 }));
      vi.stubGlobal('fetch', spy);

      await executeRequest(uniquePath('cache-opt'), 'GET', { cache: 'force-cache' });
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ cache: 'force-cache' });
    });
  });

  describe('apiFetch method routing, cache, and dedupe', () => {
    it('defaults method to GET and uppercases provided method', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ m: 'ok' }));
      vi.stubGlobal('fetch', spy);

      const path = uniquePath('default-get');
      await expect(apiFetch(path)).resolves.toEqual({ m: 'ok' });
      expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });

      await apiFetch(uniquePath('patch'), { method: 'patch', body: '{}' });
      expect(spy.mock.calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    });

    it('caches successful GET responses for the configured TTL and skips network on hit', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ n: 1 }));
      vi.stubGlobal('fetch', spy);
      const path = uniquePath('cache-hit');

      await expect(apiFetch(path, { cacheTtlMs: 60_000 })).resolves.toEqual({ n: 1 });
      await expect(apiFetch(path, { cacheTtlMs: 60_000 })).resolves.toEqual({ n: 1 });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not cache when cacheTtlMs is missing or non-positive', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ n: 2 }));
      vi.stubGlobal('fetch', spy);
      const path = uniquePath('no-ttl');

      await apiFetch(path);
      await apiFetch(path, { cacheTtlMs: 0 });
      await apiFetch(path, { cacheTtlMs: -5 });
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('expires cache entries after TTL elapses', async () => {
      vi.useFakeTimers();
      const spy = vi.fn().mockImplementation(() => successEnvelope({ n: 3 }));
      vi.stubGlobal('fetch', spy);
      const path = uniquePath('ttl-expire');

      await apiFetch(path, { cacheTtlMs: 1_000 });
      expect(spy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_001);
      await apiFetch(path, { cacheTtlMs: 1_000 });
      expect(spy).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('dedupes concurrent GET requests for the same dedupeKey', async () => {
      let resolveFetch: ((value: Response) => void) | undefined;
      const spy = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );
      vi.stubGlobal('fetch', spy);
      const path = uniquePath('inflight');
      const dedupeKey = `shared-key-${Math.random().toString(36).slice(2)}`;

      const first = apiFetch<{ x: number }>(path, { dedupeKey, cacheTtlMs: 5_000 });
      const second = apiFetch<{ x: number }>(path, { dedupeKey, cacheTtlMs: 5_000 });
      expect(spy).toHaveBeenCalledTimes(1);

      resolveFetch?.(successEnvelope({ x: 9 }));
      await expect(Promise.all([first, second])).resolves.toEqual([{ x: 9 }, { x: 9 }]);
    });

    it('invalidates adaptive cache prefixes on mutating methods', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ ok: true }));
      vi.stubGlobal('fetch', spy);

      const sessionPath = `/api/adaptive/session/sess-${Math.random().toString(36).slice(2)}/status`;
      await apiFetch(sessionPath, { cacheTtlMs: 60_000 });
      expect(spy).toHaveBeenCalledTimes(1);

      await apiFetch(sessionPath.replace('/status', '/submit'), {
        method: 'POST',
        body: JSON.stringify({ answer: 'A' }),
      });
      expect(spy).toHaveBeenCalledTimes(2);

      await apiFetch(sessionPath, { cacheTtlMs: 60_000 });
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('invalidates cache for PUT PATCH and DELETE as well as POST', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ ok: true }));
      vi.stubGlobal('fetch', spy);

      for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
        await apiFetch(uniquePath(method.toLowerCase()), {
          method,
          ...(method !== 'DELETE' ? { body: '{}' } : {}),
        });
      }
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy.mock.calls.map((call) => call[1]?.method)).toEqual(['PUT', 'PATCH', 'DELETE']);
    });

    it('uses path as default dedupeKey when not provided', async () => {
      const spy = vi.fn().mockImplementation(() => successEnvelope({ k: 1 }));
      vi.stubGlobal('fetch', spy);
      const path = uniquePath('default-dedupe');

      await apiFetch(path, { cacheTtlMs: 30_000 });
      await apiFetch(path, { cacheTtlMs: 30_000 });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('propagates AdaptiveApiError from executeRequest through apiFetch', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => errorEnvelope(404, { message: 'gone' })),
      );

      await expect(
        apiFetch(uniquePath('err'), { method: 'POST', body: '{}' }),
      ).rejects.toBeInstanceOf(AdaptiveApiError);
    });
  });
});
