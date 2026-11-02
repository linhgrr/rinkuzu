import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { apiErr, apiForward } from '@/lib/api/response';
import { isStandardErrorEnvelope, isStandardSuccessEnvelope } from '@/lib/api/envelope';
import { logger } from '@/lib/logger';
import { isCacheSafeAdaptivePath } from './cache-policy';
import {
  buildAdaptiveInfraUrl,
  buildAdaptiveServiceHeaders,
  buildAdaptiveUrl,
  resolveAdaptiveProxyTimeoutMs,
} from './config';
import type { UserRole } from '@/types/next-auth';
import {
  buildLlmRateLimitHeaders,
  buildLlmRateLimitResponse,
  commitLlmUsage,
  refundLlmUsage,
  reserveLlmUsage,
  type LlmUsageJobLink,
  type LlmUsageReservation,
  type LlmRateLimitAction,
} from '@/lib/llm/rate-limit';

type AdaptiveProxyMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ProxyOptions = {
  method?: AdaptiveProxyMethod;
  body?: BodyInit | null;
  contentType?: string | null;
  timeoutMs?: number;
  // LLM-backed routes declare their metered action explicitly. Enforced here
  // before forwarding upstream. Non-LLM routes leave this undefined.
  llmAction?: LlmRateLimitAction;
  // Async LLM routes: read the accepted job from the success envelope so the
  // committed unit can be refunded if that job later fails.
  llmJobLink?: (payload: unknown) => LlmUsageJobLink | null;
  cache?: {
    revalidateSeconds: number;
    tags: string[];
  };
  // Target an unversioned infra endpoint (/api/<path>) instead of the
  // canonical /api surface. Used for health/ready/live/info.
  infra?: boolean;
  // Trusted server-generated headers only. Never populate this from request headers.
  internalHeaders?: Readonly<Record<string, string>>;
  // Only endpoints with their own durable response replay may forward a
  // previously committed idempotency key without consuming quota again.
  allowCommittedReplay?: boolean;
  // Forward only a syntactically valid LLM configuration ETag. No other
  // browser header is copied through this option.
  forwardIfMatch?: boolean;
};

/**
 * User context forwarded to the adaptive service.
 * Callers obtain this from `withAuth` / `withOptionalAuth` in @/lib/api/auth.
 */
export type ProxyAuthContext = {
  userId?: string;
  userRole?: UserRole | null;
};

// End-to-end headers only. Hop-by-hop headers (e.g. connection) must not be
// forwarded from upstream through this proxy.
const UPSTREAM_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'vary',
  'x-accel-buffering',
] as const;

const TRUSTED_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const LLM_CONFIG_ETAG = /^"llm-config-[1-9][0-9]*"$/;

function trustedRequestId(req: Request): string {
  const candidate = req.headers.get('x-request-id')?.trim();
  return candidate && TRUSTED_REQUEST_ID.test(candidate) ? candidate : crypto.randomUUID();
}

function buildTargetUrl(req: Request, targetPath: string, infra: boolean): URL {
  const targetUrl = new URL(
    infra ? buildAdaptiveInfraUrl(targetPath) : buildAdaptiveUrl(targetPath),
  );
  const incomingUrl = new URL(req.url);

  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}

function shouldAttachBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase());
}

function isHtmlResponse(contentType: string | null): boolean {
  return (contentType ?? '').toLowerCase().includes('text/html');
}

function isJsonResponse(contentType: string | null): boolean {
  const normalized = (contentType ?? '').toLowerCase();
  return normalized.includes('application/json') || normalized.includes('+json');
}

function copyUpstreamResponseHeaders(response: Response): Headers {
  const responseHeaders = new Headers();

  for (const headerName of UPSTREAM_RESPONSE_HEADERS) {
    const headerValue = response.headers.get(headerName);
    if (headerValue) {
      responseHeaders.set(headerName, headerValue);
    }
  }

  return responseHeaders;
}

function applyResponseHeaders(target: Response, headers: Headers): Response {
  headers.forEach((value, key) => target.headers.set(key, value));
  return target;
}

function meteredStream(
  body: ReadableStream<Uint8Array>,
  reservation: LlmUsageReservation,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let settled = false;

  const commit = async () => {
    if (settled) return;
    settled = true;
    await commitLlmUsage(reservation);
  };
  const refund = async () => {
    if (settled) return;
    settled = true;
    await refundLlmUsage(reservation);
  };
  const inspect = async (chunk: Uint8Array) => {
    pending += decoder.decode(chunk, { stream: true });
    pending = pending.replaceAll('\r\n', '\n');
    const events = pending.split('\n\n');
    pending = events.pop() ?? '';
    for (const eventBlock of events) {
      for (const line of eventBlock.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6)) as { type?: string; delta?: unknown };
          const isTextDelta =
            event.type === 'response.output_text.delta' || event.type === 'TEXT_MESSAGE_CONTENT';
          if (isTextDelta && typeof event.delta === 'string' && event.delta.trim()) {
            await commit();
          }
          if ((event.type === 'response.failed' || event.type === 'RUN_ERROR') && !settled) {
            await refund();
          }
        } catch {
          // A split event remains buffered; malformed terminal streams refund on close.
        }
      }
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          if (!settled) await refund();
          controller.close();
          return;
        }
        await inspect(result.value);
        controller.enqueue(result.value);
      } catch (error) {
        if (!settled) await refund();
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      if (!settled) await refund();
    },
  });
}

export async function proxyAdaptiveRequest(
  req: Request,
  targetPath: string,
  auth: ProxyAuthContext,
  options?: ProxyOptions,
) {
  let llmReservation: LlmUsageReservation | null = null;
  try {
    const { userId, userRole } = auth;

    const targetUrl = buildTargetUrl(req, targetPath, options?.infra ?? false);
    const headers: Record<string, string> = buildAdaptiveServiceHeaders(userId, userRole);
    Object.assign(headers, options?.internalHeaders);
    const method = options?.method || req.method;
    headers['x-request-id'] = trustedRequestId(req);

    if (options?.forwardIfMatch) {
      const ifMatch = req.headers.get('if-match')?.trim();
      if (ifMatch && !LLM_CONFIG_ETAG.test(ifMatch)) {
        return apiErr('validation_error', 'Invalid If-Match header', 400);
      }
      if (ifMatch) headers['If-Match'] = ifMatch;
    }

    const llmAction = options?.llmAction;
    const requestId =
      req.headers.get('idempotency-key') ?? req.headers.get('x-request-id') ?? crypto.randomUUID();
    const llmRateLimit =
      llmAction && userId && userRole !== 'admin'
        ? await reserveLlmUsage(userId, llmAction, requestId)
        : null;
    llmReservation = llmRateLimit;
    if (llmRateLimit && !llmRateLimit.allowed) {
      if (llmRateLimit.duplicate && llmRateLimit.disposition === 'reserved') {
        return apiErr('request_in_progress', 'A request with this id is already in progress', 409);
      }
      return buildLlmRateLimitResponse(llmRateLimit);
    }
    if (
      llmRateLimit?.duplicate &&
      llmRateLimit.disposition === 'committed' &&
      !options?.allowCommittedReplay
    ) {
      return apiErr('request_already_completed', 'This request was already completed', 409);
    }

    const contentType =
      options?.contentType === undefined ? req.headers.get('content-type') : options.contentType;
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const timeoutMs =
      options?.timeoutMs && options.timeoutMs > 0
        ? options.timeoutMs
        : resolveAdaptiveProxyTimeoutMs();
    const upstreamAbort = AbortSignal.any([AbortSignal.timeout(timeoutMs), req.signal]);
    const body = options?.body ?? (shouldAttachBody(method) ? await req.text() : undefined);

    const cacheOptions = options?.cache;
    const allowCache =
      !!cacheOptions &&
      isCacheSafeAdaptivePath(targetPath) &&
      !shouldAttachBody(method) &&
      cacheOptions.revalidateSeconds > 0 &&
      cacheOptions.tags.length > 0;
    const nextOptions =
      allowCache && cacheOptions
        ? {
            revalidate: cacheOptions.revalidateSeconds,
            tags: cacheOptions.tags,
          }
        : undefined;

    const response = await fetch(targetUrl.toString(), {
      method,
      headers,
      ...(body !== undefined && { body }),
      cache: allowCache ? 'force-cache' : 'no-store',
      ...(nextOptions !== undefined && { next: nextOptions }),
      signal: upstreamAbort,
    });

    const contentTypeHeader = response.headers.get('content-type');
    if (isHtmlResponse(contentTypeHeader)) {
      if (llmReservation) await refundLlmUsage(llmReservation);
      return apiErr(
        'upstream_html_error',
        'Adaptive service temporarily unavailable',
        response.ok ? 502 : response.status,
        { targetPath },
      );
    }

    const responseHeaders = copyUpstreamResponseHeaders(response);
    if (llmRateLimit) {
      const rateLimitHeaders = buildLlmRateLimitHeaders(llmRateLimit);
      Object.entries(rateLimitHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
    }

    if (!response.ok) {
      const upstreamText = await response.text();
      let payload: unknown = null;

      if (upstreamText) {
        try {
          payload = JSON.parse(upstreamText);
        } catch {
          payload = null;
        }
      }

      if (!isStandardErrorEnvelope(payload)) {
        if (llmReservation) await refundLlmUsage(llmReservation);
        // Never reflect or log raw upstream error bodies — they may contain
        // stack traces, internal paths, or other sensitive detail.
        return applyResponseHeaders(
          apiErr(
            'upstream_invalid_envelope',
            'Adaptive service returned a non-standard error envelope',
            502,
            { targetPath, upstreamStatus: response.status },
          ),
          responseHeaders,
        );
      }

      if (llmReservation) {
        if (response.status >= 500 || response.status === 429) {
          await refundLlmUsage(llmReservation);
        } else {
          await commitLlmUsage(llmReservation);
        }
      }

      const forwarded = apiForward(payload, response.status);
      return applyResponseHeaders(forwarded, responseHeaders);
    }

    if (response.status === 204) {
      if (llmReservation) await commitLlmUsage(llmReservation);
      return new Response(null, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (isJsonResponse(contentTypeHeader)) {
      const upstreamText = await response.text();
      let payload: unknown = null;

      if (upstreamText) {
        try {
          payload = JSON.parse(upstreamText);
        } catch {
          if (llmReservation) await refundLlmUsage(llmReservation);
          return applyResponseHeaders(
            apiErr('upstream_invalid_json', 'Adaptive service returned invalid JSON', 502, {
              targetPath,
            }),
            responseHeaders,
          );
        }
      }

      if (!isStandardSuccessEnvelope(payload)) {
        if (llmReservation) await refundLlmUsage(llmReservation);
        return applyResponseHeaders(
          apiErr(
            'upstream_invalid_envelope',
            'Adaptive service returned a non-standard success envelope',
            502,
            { targetPath },
          ),
          responseHeaders,
        );
      }

      if (llmReservation) {
        const jobLink = options?.llmJobLink?.(payload) ?? null;
        await (jobLink ? commitLlmUsage(llmReservation, jobLink) : commitLlmUsage(llmReservation));
      }
      const normalized = apiForward(payload, response.status);
      return applyResponseHeaders(normalized, responseHeaders);
    }

    if (!response.body) {
      if (llmReservation) await refundLlmUsage(llmReservation);
      return apiErr('upstream_invalid_envelope', 'Adaptive service returned an empty body', 502);
    }
    return new NextResponse(
      llmReservation ? meteredStream(response.body, llmReservation) : response.body,
      {
        status: response.status,
        headers: responseHeaders,
      },
    );
  } catch (error) {
    if (llmReservation) await refundLlmUsage(llmReservation);
    // AbortSignal.timeout() rejects with DOMException name TimeoutError (Node 22+).
    // Client cancellation and AbortSignal.any composition typically use AbortError.
    // Both are abort-like; distinguish client cancel vs upstream timeout via req.signal.
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      if (req.signal.aborted) {
        return apiErr('request_aborted', 'Request was cancelled by the client', 499);
      }
      return apiErr('upstream_timeout', 'Adaptive service request timed out', 504);
    }
    logger.error({ targetPath, error }, 'Adaptive proxy failed');
    return apiErr('internal_error', 'Internal server error while proxying adaptive request', 500);
  }
}
