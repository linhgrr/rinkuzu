/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeRequest } from '@/features/adaptive/lib/adaptive-api-fetch';
import {
  AdaptiveApiError,
  adaptiveErrorForDisplay,
} from '@/features/adaptive/lib/adaptive-api-error';
import { subscribeToApiErrors } from '@/lib/api/error-events';
import { describeApiError } from '@/lib/api/error-kind';

// RIN-754: adaptive failures must classify through the shared error layer (RIN-748 contract).

function errorResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function failureOf(response: Response): Promise<AdaptiveApiError> {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  const error = await executeRequest(`/api/adaptive/x-${Math.random()}`, 'POST', {
    body: '{}',
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AdaptiveApiError);
  return error as AdaptiveApiError;
}

describe('adaptive fetch → describeApiError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('classifies a 413 without a code as validation', async () => {
    const error = await failureOf(errorResponse(413, 'Request Entity Too Large'));
    expect(error.code).toBe('validation_error');
    expect(describeApiError(adaptiveErrorForDisplay(error)).kind).toBe('validation');
  });

  it('classifies a 415 without a code as unsupported_media_type with its own copy', async () => {
    const error = await failureOf(errorResponse(415, { success: false, error: {} }));
    const described = describeApiError(adaptiveErrorForDisplay(error));
    expect(described).toMatchObject({
      kind: 'validation',
      code: 'unsupported_media_type',
      messageKey: 'errors.api.codes.unsupportedMediaType',
    });
  });

  it('classifies a 429 without a code as rate_limited and keeps Retry-After', async () => {
    const error = await failureOf(
      errorResponse(429, { success: false, error: { message: 'slow' } }, { 'Retry-After': '42' }),
    );
    expect(error.code).toBe('rate_limit_exceeded');
    expect(describeApiError(error)).toMatchObject({
      kind: 'rate_limited',
      retryable: true,
      retryAfterSeconds: 42,
      messageKey: 'errors.api.rateLimitedSeconds',
      messageValues: { seconds: 42 },
    });
  });

  it('classifies a 503 as unavailable and retryable', async () => {
    const error = await failureOf(errorResponse(503, { success: false, error: {} }));
    expect(describeApiError(error)).toMatchObject({ kind: 'unavailable', retryable: true });
  });

  it('classifies a dropped connection as network, not "service down"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await executeRequest('/api/adaptive/net', 'GET').catch((e: unknown) => e);
    expect(describeApiError(adaptiveErrorForDisplay(error)).kind).toBe('network');
  });

  it('shows a timeout (request_aborted from timedFetch) as upstream_timeout, not nothing', () => {
    const timeout = new AdaptiveApiError({
      message: 'Request timed out or was interrupted',
      code: 'request_aborted',
      retryable: true,
    });
    expect(describeApiError(timeout).kind).toBe('aborted');
    expect(describeApiError(adaptiveErrorForDisplay(timeout))).toMatchObject({
      kind: 'unavailable',
      code: 'upstream_timeout',
      retryable: true,
    });
  });

  it('keeps meta and opens the upgrade prompt once for an eligible quota_exceeded', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToApiErrors(listener);
    try {
      const error = await failureOf(
        errorResponse(429, {
          success: false,
          error: {
            code: 'quota_exceeded',
            message: 'Usage quota exceeded',
            meta: { upgradeEligible: true },
          },
        }),
      );
      expect(error.meta).toEqual({ upgradeEligible: true });
      expect(describeApiError(error)).toMatchObject({
        kind: 'unlock_required',
        messageKey: 'errors.api.codes.quotaExceeded',
      });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0]).toMatchObject({ code: 'quota_exceeded', status: 429 });
    } finally {
      unsubscribe();
    }
  });

  it('does not open the upgrade prompt for a plain rate limit', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToApiErrors(listener);
    try {
      await failureOf(
        errorResponse(429, { success: false, error: { code: 'rate_limit_exceeded' } }),
      );
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
