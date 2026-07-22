import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmRateLimitAction } from '@/lib/llm/rate-limit';

const configMocks = vi.hoisted(() => ({
  buildAdaptiveInfraUrl: vi.fn((path: string) => `https://adaptive.test/api/${path}`),
  buildAdaptiveServiceHeaders: vi.fn(
    (userId?: string, userRole?: string | null): Record<string, string> => ({
      ...(userId ? { 'X-User-Id': userId } : {}),
      ...(userRole ? { 'X-User-Role': userRole } : {}),
    }),
  ),
  buildAdaptiveUrl: vi.fn((path: string) => `https://adaptive.test/api/v1/${path}`),
  resolveAdaptiveProxyTimeoutMs: vi.fn(() => 30_000),
}));

const cachePolicyMocks = vi.hoisted(() => ({
  isCacheSafeAdaptivePath: vi.fn(() => true),
}));

const rateLimitMocks = vi.hoisted(() => {
  const allowedResult = {
    allowed: true as const,
    disposition: 'reserved' as const,
    userId: 'user-1',
    tier: 'free' as const,
    action: 'ask_rin_chan' as LlmRateLimitAction,
    requestId: 'request-1',
    duplicate: false,
    windows: [
      {
        window: 'minute' as const,
        limit: 5,
        remaining: 4,
        resetAt: new Date('2026-07-17T12:00:00.000Z'),
        count: 1,
      },
      {
        window: 'day' as const,
        limit: 25,
        remaining: 24,
        resetAt: new Date('2026-07-18T00:00:00.000Z'),
        count: 1,
      },
    ],
  };

  return {
    allowedResult,
    deniedResult: {
      ...allowedResult,
      allowed: false as const,
      disposition: 'denied' as const,
      retryAfterSeconds: 42,
      windows: allowedResult.windows.map((window) =>
        window.window === 'minute' ? { ...window, remaining: 0, count: 6 } : window,
      ),
    },
    reserveLlmUsage: vi.fn(),
    commitLlmUsage: vi.fn(),
    refundLlmUsage: vi.fn(),
    buildLlmRateLimitHeaders: vi.fn(() => ({
      'X-RateLimit-Tier': 'free',
      'X-RateLimit-Action': 'ask_rin_chan',
      'X-RateLimit-Limit': '25',
      'X-RateLimit-Remaining': '24',
      'X-RateLimit-Reset': '2026-07-18T00:00:00.000Z',
    })),
    buildLlmRateLimitResponse: vi.fn(() =>
      Response.json(
        {
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'Usage quota exceeded',
            meta: { tier: 'free', upgradeEligible: true },
          },
        },
        { status: 429 },
      ),
    ),
  };
});

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: class NextResponse extends Response {
    static override json(body: unknown, init?: ResponseInit): Response {
      return Response.json(body, init);
    }
  },
}));

vi.mock('@/lib/adaptive/config', () => configMocks);
vi.mock('@/lib/adaptive/cache-policy', () => cachePolicyMocks);
vi.mock('@/lib/llm/rate-limit', () => ({
  reserveLlmUsage: rateLimitMocks.reserveLlmUsage,
  commitLlmUsage: rateLimitMocks.commitLlmUsage,
  refundLlmUsage: rateLimitMocks.refundLlmUsage,
  buildLlmRateLimitHeaders: rateLimitMocks.buildLlmRateLimitHeaders,
  buildLlmRateLimitResponse: rateLimitMocks.buildLlmRateLimitResponse,
}));
vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}));

import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function successEnvelope(data: unknown, status = 200): Response {
  return jsonResponse({ success: true, data }, { status });
}

function sseResponse(events: unknown[]): Response {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

function getFetchInit(
  callIndex = 0,
): RequestInit & { next?: { revalidate: number; tags: string[] } } {
  const call = vi.mocked(fetch).mock.calls[callIndex];
  if (!call) {
    throw new Error(`fetch was not called at index ${callIndex}`);
  }
  return (call[1] ?? {}) as RequestInit & { next?: { revalidate: number; tags: string[] } };
}

function getFetchUrl(callIndex = 0): string {
  const call = vi.mocked(fetch).mock.calls[callIndex];
  if (!call?.[0]) {
    throw new Error(`fetch was not called at index ${callIndex}`);
  }
  return String(call[0]);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

describe('proxyAdaptiveRequest mutation coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachePolicyMocks.isCacheSafeAdaptivePath.mockReturnValue(true);
    configMocks.resolveAdaptiveProxyTimeoutMs.mockReturnValue(30_000);
    rateLimitMocks.reserveLlmUsage.mockResolvedValue(rateLimitMocks.allowedResult);
    rateLimitMocks.buildLlmRateLimitHeaders.mockReturnValue({
      'X-RateLimit-Tier': 'free',
      'X-RateLimit-Action': 'ask_rin_chan',
      'X-RateLimit-Limit': '25',
      'X-RateLimit-Remaining': '24',
      'X-RateLimit-Reset': '2026-07-18T00:00:00.000Z',
    });
    rateLimitMocks.buildLlmRateLimitResponse.mockReturnValue(
      Response.json(
        {
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'Usage quota exceeded',
            meta: { tier: 'free', upgradeEligible: true },
          },
        },
        { status: 429 },
      ),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('request shaping', () => {
    it('forwards query params onto versioned adaptive URLs for default requests', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects?page=2&q=math'),
        'subjects',
        { userId: 'user-1', userRole: 'user' },
      );

      expect(configMocks.buildAdaptiveUrl).toHaveBeenCalledWith('subjects');
      expect(configMocks.buildAdaptiveInfraUrl).not.toHaveBeenCalled();
      expect(getFetchUrl()).toBe('https://adaptive.test/api/v1/subjects?page=2&q=math');
      expect(getFetchInit()).toMatchObject({
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-User-Id': 'user-1', 'X-User-Role': 'user' },
      });
      expect(getFetchInit()).not.toHaveProperty('body');
      expect(getFetchInit()).not.toHaveProperty('next');
    });

    it('routes infra targets through the unversioned adaptive base URL', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
        { infra: true },
      );

      expect(configMocks.buildAdaptiveInfraUrl).toHaveBeenCalledWith('health');
      expect(getFetchUrl()).toBe('https://adaptive.test/api/health');
    });

    it('adds only explicit server-generated internal headers', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/pipeline/process'),
        'pipeline/process',
        { userId: 'user-1', userRole: 'user' },
        { internalHeaders: { 'x-rinkuzu-pdf-page-limit': '30' } },
      );

      expect(getFetchInit().headers).toMatchObject({
        'X-User-Id': 'user-1',
        'X-User-Role': 'user',
        'x-rinkuzu-pdf-page-limit': '30',
      });
    });

    it('attaches POST body text and content-type from the incoming request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successEnvelope({ ok: true }));

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'hello' }),
        }),
        'chat',
        { userId: 'user-1' },
        { method: 'POST' },
      );

      const init = getFetchInit();
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ prompt: 'hello' }));
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    });

    it('prefers explicit options.body and options.contentType over the request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successEnvelope({ ok: true }));

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'ignored',
        }),
        'chat',
        {},
        {
          method: 'POST',
          body: 'explicit-body',
          contentType: 'application/x-custom',
        },
      );

      const init = getFetchInit();
      expect(init.body).toBe('explicit-body');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-custom' });
    });

    it('omits Content-Type when options.contentType is explicitly null', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successEnvelope({ ok: true }));

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
        'chat',
        {},
        { method: 'POST', contentType: null, body: '{}' },
      );

      const headers = getFetchInit().headers as Record<string, string>;
      expect(headers['Content-Type']).toBeUndefined();
    });

    it('uses a positive options.timeoutMs instead of the configured default', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
        { timeoutMs: 1_500 },
      );

      expect(configMocks.resolveAdaptiveProxyTimeoutMs).not.toHaveBeenCalled();
      expect(getFetchInit().signal).toBeInstanceOf(AbortSignal);
    });

    it('falls back to the configured timeout when options.timeoutMs is zero or negative', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
        { timeoutMs: 0 },
      );
      expect(configMocks.resolveAdaptiveProxyTimeoutMs).toHaveBeenCalledOnce();

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
        { timeoutMs: -5 },
      );
      expect(configMocks.resolveAdaptiveProxyTimeoutMs).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache policy', () => {
    it('enables force-cache and next tags only for safe GET cache options', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
        { cache: { revalidateSeconds: 30, tags: ['adaptive-subjects'] } },
      );

      expect(cachePolicyMocks.isCacheSafeAdaptivePath).toHaveBeenCalledWith('subjects');
      expect(getFetchInit()).toMatchObject({
        cache: 'force-cache',
        next: { revalidate: 30, tags: ['adaptive-subjects'] },
      });
    });

    it('rejects cache options when the path is unsafe, method has a body, revalidate is zero, or tags are empty', async () => {
      cachePolicyMocks.isCacheSafeAdaptivePath.mockReturnValueOnce(false);
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat'),
        'chat',
        {},
        { cache: { revalidateSeconds: 30, tags: ['x'] } },
      );
      expect(getFetchInit(0).cache).toBe('no-store');
      expect(getFetchInit(0)).not.toHaveProperty('next');

      vi.mocked(fetch).mockResolvedValueOnce(successEnvelope({ ok: true }));
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', {
          method: 'POST',
          body: '{}',
        }),
        'chat',
        {},
        {
          method: 'POST',
          body: '{}',
          cache: { revalidateSeconds: 30, tags: ['x'] },
        },
      );
      expect(getFetchInit(1).cache).toBe('no-store');
      expect(getFetchInit(1)).not.toHaveProperty('next');

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
        { cache: { revalidateSeconds: 0, tags: ['x'] } },
      );
      expect(getFetchInit(2).cache).toBe('no-store');
      expect(getFetchInit(2)).not.toHaveProperty('next');

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
        { cache: { revalidateSeconds: 30, tags: [] } },
      );
      expect(getFetchInit(3).cache).toBe('no-store');
      expect(getFetchInit(3)).not.toHaveProperty('next');
    });
  });

  describe('LLM rate limiting', () => {
    it.each([
      ['legacy', { type: 'response.output_text.delta', delta: 'answer' }],
      ['AG-UI', { type: 'TEXT_MESSAGE_CONTENT', messageId: 'message-1', delta: 'answer' }],
    ])('commits usage on the first non-empty %s text delta', async (_name, event) => {
      vi.mocked(fetch).mockResolvedValueOnce(sseResponse([event]));

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/ask-rin-chan/agent', {
          method: 'POST',
          body: '{}',
        }),
        'ask-rin-chan/agent',
        { userId: 'user-1', userRole: 'user' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );
      await response.text();

      expect(rateLimitMocks.commitLlmUsage).toHaveBeenCalledOnce();
      expect(rateLimitMocks.refundLlmUsage).not.toHaveBeenCalled();
    });

    it.each([
      ['legacy', { type: 'response.failed', response: { error: { message: 'failed' } } }],
      ['AG-UI', { type: 'RUN_ERROR', code: 'ask_rin_run_failed', message: 'failed' }],
    ])('refunds usage when a %s stream fails before producing text', async (_name, event) => {
      vi.mocked(fetch).mockResolvedValueOnce(sseResponse([event]));

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/ask-rin-chan/agent', {
          method: 'POST',
          body: '{}',
        }),
        'ask-rin-chan/agent',
        { userId: 'user-1', userRole: 'user' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );
      await response.text();

      expect(rateLimitMocks.refundLlmUsage).toHaveBeenCalledOnce();
      expect(rateLimitMocks.commitLlmUsage).not.toHaveBeenCalled();
    });

    it('blocks committed idempotency-key replay unless the endpoint owns durable replay', async () => {
      const committed = {
        ...rateLimitMocks.allowedResult,
        disposition: 'committed' as const,
        duplicate: true,
      };
      rateLimitMocks.reserveLlmUsage.mockResolvedValue(committed);
      const request = new Request('https://app.test/api/adaptive/chat', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'request-1' },
        body: '{}',
      });

      const blocked = await proxyAdaptiveRequest(
        request,
        'chat',
        { userId: 'user-1', userRole: 'user' },
        { method: 'POST', llmAction: 'adaptive_generation', body: '{}' },
      );
      expect(blocked.status).toBe(409);
      expect(fetch).not.toHaveBeenCalled();

      await proxyAdaptiveRequest(
        request,
        'ask-rin-chan/agent',
        { userId: 'user-1', userRole: 'user' },
        {
          method: 'POST',
          llmAction: 'ask_rin_chan',
          body: '{}',
          allowCommittedReplay: true,
        },
      );
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('returns the rate-limit response when the metered user is blocked', async () => {
      rateLimitMocks.reserveLlmUsage.mockResolvedValueOnce(rateLimitMocks.deniedResult);

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', { method: 'POST', body: '{}' }),
        'chat',
        { userId: 'user-1', userRole: 'user' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );

      expect(rateLimitMocks.reserveLlmUsage).toHaveBeenCalledWith(
        'user-1',
        'ask_rin_chan',
        expect.any(String),
      );
      expect(rateLimitMocks.buildLlmRateLimitResponse).toHaveBeenCalledWith(
        rateLimitMocks.deniedResult,
      );
      expect(response.status).toBe(429);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('skips rate limiting for admins and for requests without userId or llmAction', async () => {
      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', { method: 'POST', body: '{}' }),
        'chat',
        { userId: 'admin-1', userRole: 'admin' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );
      expect(rateLimitMocks.reserveLlmUsage).not.toHaveBeenCalled();

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', { method: 'POST', body: '{}' }),
        'chat',
        { userRole: 'user' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );
      expect(rateLimitMocks.reserveLlmUsage).not.toHaveBeenCalled();

      await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        { userId: 'user-1', userRole: 'user' },
      );
      expect(rateLimitMocks.reserveLlmUsage).not.toHaveBeenCalled();
    });

    it('attaches rate-limit headers to successful upstream responses when metering applied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(successEnvelope({ answer: 1 }));

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/chat', { method: 'POST', body: '{}' }),
        'chat',
        { userId: 'user-1', userRole: 'user' },
        { method: 'POST', llmAction: 'ask_rin_chan', body: '{}' },
      );

      expect(rateLimitMocks.buildLlmRateLimitHeaders).toHaveBeenCalledWith(
        rateLimitMocks.allowedResult,
      );
      expect(rateLimitMocks.commitLlmUsage).toHaveBeenCalledWith(rateLimitMocks.allowedResult);
      expect(response.headers.get('X-RateLimit-Action')).toBe('ask_rin_chan');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('24');
      await expect(readJson(response)).resolves.toEqual({
        success: true,
        data: { answer: 1 },
      });
    });
  });

  describe('upstream response handling', () => {
    it('maps HTML upstream responses to upstream_html_error with 502 when ok and original status otherwise', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('<html>down</html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      );
      const okHtml = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );
      expect(okHtml.status).toBe(502);
      await expect(readJson(okHtml)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_html_error',
          detail: 'Adaptive service temporarily unavailable',
          meta: { targetPath: 'health' },
        },
      });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('<html>error</html>', {
          status: 503,
          headers: { 'content-type': 'TEXT/HTML' },
        }),
      );
      const badHtml = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );
      expect(badHtml.status).toBe(503);
      await expect(readJson(badHtml)).resolves.toMatchObject({
        success: false,
        error: { code: 'upstream_html_error' },
      });
    });

    it('forwards standard error envelopes and preserves selected end-to-end upstream headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: { code: 'not_found', message: 'x' } }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json',
              etag: '"abc"',
              'cache-control': 'no-store',
              connection: 'keep-alive',
              'x-ignored': 'drop-me',
            },
          },
        ),
      );

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects/1'),
        'subjects/1',
        {},
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('etag')).toBe('"abc"');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('connection')).toBeNull();
      expect(response.headers.get('x-ignored')).toBeNull();
      await expect(readJson(response)).resolves.toEqual({
        success: false,
        error: { code: 'not_found', message: 'x' },
      });
    });

    it('returns a fixed generic upstream_invalid_envelope without reflecting raw upstream error text', async () => {
      const secretBody =
        'SECRET_TOKEN=abc123 stack: Error at /internal/db.js:42\n  at handleRequest';
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(secretBody, {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const invalid = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/x'),
        'x',
        {},
      );
      expect(invalid.status).toBe(502);
      const invalidBody = await readJson(invalid);
      expect(invalidBody).toMatchObject({
        success: false,
        error: {
          code: 'upstream_invalid_envelope',
          detail: 'Adaptive service returned a non-standard error envelope',
          meta: { targetPath: 'x', upstreamStatus: 500 },
        },
      });
      const publicText = JSON.stringify(invalidBody);
      expect(publicText).not.toContain('SECRET_TOKEN');
      expect(publicText).not.toContain('/internal/db.js');
      expect(publicText).not.toContain('stack:');
      expect(loggerMocks.error).not.toHaveBeenCalled();

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('', {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const empty = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/x'),
        'x',
        {},
      );
      await expect(readJson(empty)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_invalid_envelope',
          detail: 'Adaptive service returned a non-standard error envelope',
          meta: { targetPath: 'x', upstreamStatus: 502 },
        },
      });
    });

    it('returns an empty 204 response with copied upstream headers', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { etag: '"204"', 'content-type': 'application/json' },
        }),
      );

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );

      expect(response.status).toBe(204);
      expect(response.headers.get('etag')).toBe('"204"');
      expect(await response.text()).toBe('');
    });

    it('forwards standard JSON success envelopes including +json content types', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { items: [1] }, meta: { page: 1 } }), {
          status: 201,
          headers: { 'content-type': 'application/vnd.api+json' },
        }),
      );

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
      );

      expect(response.status).toBe(201);
      await expect(readJson(response)).resolves.toEqual({
        success: true,
        data: { items: [1] },
        meta: { page: 1 },
      });
    });

    it('rejects invalid JSON and non-standard success envelopes', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('{not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const invalidJson = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
      );
      expect(invalidJson.status).toBe(502);
      await expect(readJson(invalidJson)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_invalid_json',
          detail: 'Adaptive service returned invalid JSON',
          meta: { targetPath: 'subjects' },
        },
      });

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
      const invalidEnvelope = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/subjects'),
        'subjects',
        {},
      );
      expect(invalidEnvelope.status).toBe(502);
      await expect(readJson(invalidEnvelope)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_invalid_envelope',
          detail: 'Adaptive service returned a non-standard success envelope',
          meta: { targetPath: 'subjects' },
        },
      });
    });

    it('streams non-JSON successful payloads through NextResponse', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('binary-bytes', {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'last-modified': 'Wed, 01 Jul 2026 00:00:00 GMT',
          },
        }),
      );

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/export'),
        'export',
        {},
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/octet-stream');
      expect(response.headers.get('last-modified')).toBe('Wed, 01 Jul 2026 00:00:00 GMT');
      await expect(response.text()).resolves.toBe('binary-bytes');
    });
  });

  describe('failure paths', () => {
    it('maps client aborts to 499 for AbortError when req.signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('aborted'), { name: 'AbortError' }),
      );

      const clientAbort = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health', { signal: controller.signal }),
        'health',
        {},
      );
      expect(clientAbort.status).toBe(499);
      await expect(readJson(clientAbort)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'request_aborted',
          detail: 'Request was cancelled by the client',
        },
      });
      expect(loggerMocks.error).not.toHaveBeenCalled();
    });

    it('maps AbortError without client abort to upstream_timeout 504', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { name: 'AbortError' }),
      );
      const timeout = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );
      expect(timeout.status).toBe(504);
      await expect(readJson(timeout)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_timeout',
          detail: 'Adaptive service request timed out',
        },
      });
      expect(loggerMocks.error).not.toHaveBeenCalled();
    });

    it('maps TimeoutError (AbortSignal.timeout) without client abort to upstream_timeout 504', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
      );
      const timeout = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );
      expect(timeout.status).toBe(504);
      await expect(readJson(timeout)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'upstream_timeout',
          detail: 'Adaptive service request timed out',
        },
      });
      expect(loggerMocks.error).not.toHaveBeenCalled();
    });

    it('maps TimeoutError with client-aborted req.signal to request_aborted 499', async () => {
      const controller = new AbortController();
      controller.abort();
      vi.mocked(fetch).mockRejectedValueOnce(
        new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
      );
      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health', { signal: controller.signal }),
        'health',
        {},
      );
      expect(response.status).toBe(499);
      await expect(readJson(response)).resolves.toMatchObject({
        success: false,
        error: { code: 'request_aborted' },
      });
    });

    it('logs unexpected failures and returns a 500 internal_error envelope', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

      const response = await proxyAdaptiveRequest(
        new Request('https://app.test/api/adaptive/health'),
        'health',
        {},
      );

      expect(response.status).toBe(500);
      expect(loggerMocks.error).toHaveBeenCalledWith(
        { targetPath: 'health', error: expect.any(Error) },
        'Adaptive proxy failed',
      );
      await expect(readJson(response)).resolves.toMatchObject({
        success: false,
        error: {
          code: 'internal_error',
          detail: 'Internal server error while proxying adaptive request',
        },
      });
    });
  });
});
