import { NextResponse } from 'next/server';
import { apiErr, apiForward } from '@/lib/api/response';
import { type ApiErrorPayload } from '@/lib/api/error';
import { logger } from '@/lib/logger';
import { isCacheSafeAdaptivePath } from './cache-policy';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
  type AdaptiveUserRole,
} from './config';
import {
  buildLlmRateLimitHeaders,
  buildLlmRateLimitResponse,
  checkLlmRateLimit,
  classifyAdaptiveLlmAction,
} from '@/lib/llm/rate-limit';

type ProxyOptions = {
  method?: string;
  body?: BodyInit | null;
  contentType?: string | null;
  timeoutMs?: number;
  cache?: {
    revalidateSeconds: number;
    tags: string[];
  };
};

/**
 * Authenticated context required to call the adaptive service.
 * Callers obtain this from `withAuth` / `withOptionalAuth` in @/lib/api/auth.
 */
export type ProxyAuthContext = {
  userId: string;
  userRole?: AdaptiveUserRole | null;
};

const UPSTREAM_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'vary',
  'connection',
  'x-accel-buffering',
] as const;

function buildTargetUrl(req: Request, targetPath: string): URL {
  const targetUrl = new URL(targetPath, resolveAdaptiveApiUrl());
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
  return (contentType || '').toLowerCase().includes('text/html');
}

function isJsonResponse(contentType: string | null): boolean {
  const normalized = (contentType || '').toLowerCase();
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

function isStandardSuccessEnvelope(payload: unknown): payload is {
  success: true;
  data: unknown;
} {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as { success?: unknown }).success === true &&
    'data' in payload
  );
}

function isStandardErrorEnvelope(payload: unknown): payload is ApiErrorPayload {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as { success?: unknown }).success === false &&
    'error' in payload
  );
}

export async function proxyAdaptiveRequest(
  req: Request,
  targetPath: string,
  auth: ProxyAuthContext,
  options?: ProxyOptions,
) {
  try {
    const { userId, userRole } = auth;

    const targetUrl = buildTargetUrl(req, targetPath);
    const headers: Record<string, string> = buildAdaptiveServiceHeaders(userId, userRole);
    const method = options?.method || req.method;

    const llmAction = classifyAdaptiveLlmAction(targetPath, method);
    const llmRateLimit =
      llmAction && userRole !== 'admin' ? await checkLlmRateLimit(userId, llmAction) : null;
    if (llmRateLimit && !llmRateLimit.allowed) {
      return buildLlmRateLimitResponse(llmRateLimit);
    }

    const contentType =
      options?.contentType === undefined ? req.headers.get('content-type') : options.contentType;
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const controller = new AbortController();
    const timeoutMs =
      options?.timeoutMs && options.timeoutMs > 0
        ? options.timeoutMs
        : resolveAdaptiveProxyTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const upstreamAbort = AbortSignal.any([controller.signal, req.signal]);
    const body = options?.body ?? (shouldAttachBody(method) ? await req.text() : undefined);

    const response = await (async () => {
      try {
        const cacheOptions = options?.cache;
        const allowCache =
          !!cacheOptions &&
          isCacheSafeAdaptivePath(targetPath) &&
          !shouldAttachBody(method) &&
          cacheOptions.revalidateSeconds > 0 &&
          cacheOptions.tags.length > 0;

        return await fetch(targetUrl.toString(), {
          method,
          headers,
          body,
          cache: allowCache ? 'force-cache' : 'no-store',
          next: allowCache
            ? {
                revalidate: cacheOptions.revalidateSeconds,
                tags: cacheOptions.tags,
              }
            : undefined,
          signal: upstreamAbort,
        });
      } finally {
        clearTimeout(timeout);
      }
    })();

    const contentTypeHeader = response.headers.get('content-type');
    if (isHtmlResponse(contentTypeHeader)) {
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
        return applyResponseHeaders(
          apiErr(
            'upstream_invalid_envelope',
            upstreamText || 'Adaptive service returned a non-standard error envelope',
            502,
            { targetPath, upstreamStatus: response.status },
          ),
          responseHeaders,
        );
      }

      const forwarded = apiForward(payload as Record<string, unknown>, response.status);
      return applyResponseHeaders(forwarded, responseHeaders);
    }

    if (response.status === 204) {
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
          return applyResponseHeaders(
            apiErr('upstream_invalid_json', 'Adaptive service returned invalid JSON', 502, {
              targetPath,
            }),
            responseHeaders,
          );
        }
      }

      if (!isStandardSuccessEnvelope(payload)) {
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

      const normalized = apiForward(payload as Record<string, unknown>, response.status);
      return applyResponseHeaders(normalized, responseHeaders);
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (req.signal.aborted) {
        return apiErr('request_aborted', 'Request was cancelled by the client', 499);
      }
      return apiErr('upstream_timeout', 'Adaptive service request timed out', 504);
    }
    logger.error({ targetPath, error }, 'Adaptive proxy failed');
    return apiErr('internal_error', 'Internal server error while proxying adaptive request', 500);
  }
}
