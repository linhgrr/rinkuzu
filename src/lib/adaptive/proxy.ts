import { NextResponse } from 'next/server';
import { apiErr, apiForward } from '@/lib/api/response';
import { isStandardErrorEnvelope, isStandardSuccessEnvelope } from '@/lib/api/envelope';
import { logger } from '@/lib/logger';
import { isCacheSafeAdaptivePath } from './cache-policy';
import {
  buildAdaptiveServiceHeaders,
  resolveAdaptiveApiUrl,
  resolveAdaptiveProxyTimeoutMs,
} from './config';
import type { UserRole } from '@/types/next-auth';
import {
  buildLlmRateLimitHeaders,
  buildLlmRateLimitResponse,
  checkLlmRateLimit,
  type LlmRateLimitAction,
} from '@/lib/llm/rate-limit';

type AdaptiveProxyMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ProxyOptions = {
  method?: AdaptiveProxyMethod;
  body?: BodyInit | null;
  contentType?: string | null;
  timeoutMs?: number;
  // LLM-backed routes declare their metered action explicitly. Enforced here
  // before forwarding upstream. Non-LLM routes leave this undefined.
  llmAction?: LlmRateLimitAction;
  cache?: {
    revalidateSeconds: number;
    tags: string[];
  };
};

/**
 * User context forwarded to the adaptive service.
 * Callers obtain this from `withAuth` / `withOptionalAuth` in @/lib/api/auth.
 */
export type ProxyAuthContext = {
  userId?: string;
  userRole?: UserRole | null;
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

    const llmAction = options?.llmAction;
    const llmRateLimit =
      llmAction && userId && userRole !== 'admin'
        ? await checkLlmRateLimit(userId, llmAction)
        : null;
    if (llmRateLimit && !llmRateLimit.allowed) {
      return buildLlmRateLimitResponse(llmRateLimit);
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

    const response = await fetch(targetUrl.toString(), {
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

      const forwarded = apiForward(payload, response.status);
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

      const normalized = apiForward(payload, response.status);
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
