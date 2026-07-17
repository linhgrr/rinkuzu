import { describe, expect, it } from 'vitest';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { getSessionStartFeedback } from '@/features/adaptive/lib/session-start-feedback';
import type { TranslateFn } from '@/features/adaptive/types/learning';

const t: TranslateFn = ((key: string) => `t:${key}`) as TranslateFn;

function apiError(
  code: string,
  overrides: Partial<ConstructorParameters<typeof AdaptiveApiError>[0]> = {},
) {
  return new AdaptiveApiError({
    message: code,
    code,
    ...overrides,
  });
}

describe('getSessionStartFeedback', () => {
  it('maps pipeline_not_completed to sessionNotReady with retryable true (dashboard + subjectDetails)', () => {
    const error = apiError('pipeline_not_completed', { status: 409, retryable: true });

    expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
      message: 't:dashboard.sessionNotReady',
      retryable: true,
    });
    expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
      message: 't:subjectDetails.sessionNotReady',
      retryable: true,
    });
  });

  it('maps request_aborted to sessionUnavailable with retryable true', () => {
    const error = apiError('request_aborted', { status: 499, retryable: true });

    expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
      message: 't:dashboard.sessionUnavailable',
      retryable: true,
    });
    expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
      message: 't:subjectDetails.sessionUnavailable',
      retryable: true,
    });
  });

  it('maps each service-unavailable code independently (OR branch, not AND)', () => {
    const codes = [
      'service_unavailable',
      'upstream_error',
      'upstream_timeout',
      'upstream_invalid_json',
      'upstream_invalid_envelope',
      'rate_limit_exceeded',
    ] as const;

    for (const code of codes) {
      const error = apiError(code, { status: 503, retryable: true });
      expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
        message: 't:dashboard.sessionUnavailable',
        retryable: true,
      });
      expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
        message: 't:subjectDetails.sessionUnavailable',
        retryable: true,
      });
    }
  });

  it('maps not_found AdaptiveApiError to sessionMissing with retryable false', () => {
    const error = apiError('not_found', { status: 404, retryable: false });

    expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
      message: 't:dashboard.sessionMissing',
      retryable: false,
    });
    expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
      message: 't:subjectDetails.sessionMissing',
      retryable: false,
    });
  });

  it('falls back to sessionOpenFailed for other AdaptiveApiError codes', () => {
    const error = apiError('validation_error', { status: 400, retryable: false });

    expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
      message: 't:dashboard.sessionOpenFailed',
      retryable: false,
    });
    expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
      message: 't:subjectDetails.sessionOpenFailed',
      retryable: false,
    });
  });

  it('falls back for plain Error, string, null, and undefined (non-AdaptiveApiError)', () => {
    for (const error of [
      new Error('boom'),
      'string-error',
      null,
      undefined,
      { code: 'not_found' },
    ]) {
      expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
        message: 't:dashboard.sessionOpenFailed',
        retryable: false,
      });
      expect(getSessionStartFeedback(t, 'subjectDetails', error)).toEqual({
        message: 't:subjectDetails.sessionOpenFailed',
        retryable: false,
      });
    }
  });

  it('does not treat non-not_found codes as sessionMissing even when message mentions missing', () => {
    const error = apiError('conflict', { message: 'session not found', status: 409 });

    expect(getSessionStartFeedback(t, 'dashboard', error)).toEqual({
      message: 't:dashboard.sessionOpenFailed',
      retryable: false,
    });
  });

  it('prefers pipeline_not_completed over other overlapping classifications', () => {
    // Only pipeline_not_completed hits the first branch; not_found must use code === 'not_found'.
    expect(
      getSessionStartFeedback(t, 'dashboard', apiError('pipeline_not_completed')).retryable,
    ).toBe(true);
    expect(getSessionStartFeedback(t, 'dashboard', apiError('not_found')).retryable).toBe(false);
    expect(getSessionStartFeedback(t, 'dashboard', apiError('request_aborted')).retryable).toBe(
      true,
    );
  });
});
