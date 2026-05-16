import { describe, expect, it } from 'vitest';

import {
  AdaptiveApiError,
  isAdaptiveApiError,
  isAdaptivePipelineNotReadyError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
  isRetryableAdaptiveError,
} from '@/features/adaptive-learning/lib/adaptive-api-error';

function makeError(code: string, retryable = false) {
  return new AdaptiveApiError({
    code,
    retryable,
    message: `error:${code}`,
  });
}

describe('adaptive api error guards', () => {
  it('recognizes AdaptiveApiError instances', () => {
    expect(isAdaptiveApiError(makeError('validation_error'))).toBe(true);
    expect(isAdaptiveApiError(new Error('boom'))).toBe(false);
    expect(isAdaptiveApiError(null)).toBe(false);
  });

  it('recognizes retryable adaptive errors', () => {
    expect(isRetryableAdaptiveError(makeError('service_unavailable', true))).toBe(true);
    expect(isRetryableAdaptiveError(makeError('service_unavailable', false))).toBe(false);
    expect(isRetryableAdaptiveError(new Error('boom'))).toBe(false);
  });

  it('recognizes request-aborted errors only', () => {
    expect(isAdaptiveRequestAbortedError(makeError('request_aborted'))).toBe(true);
    expect(isAdaptiveRequestAbortedError(makeError('service_unavailable'))).toBe(false);
    expect(isAdaptiveRequestAbortedError(new Error('boom'))).toBe(false);
  });

  it('recognizes service-unavailable family errors', () => {
    const codes = [
      'service_unavailable',
      'upstream_error',
      'upstream_timeout',
      'upstream_invalid_json',
      'upstream_invalid_envelope',
      'rate_limit_exceeded',
    ] as const;

    for (const code of codes) {
      expect(isAdaptiveServiceUnavailableError(makeError(code))).toBe(true);
    }

    expect(isAdaptiveServiceUnavailableError(makeError('pipeline_not_completed'))).toBe(false);
    expect(isAdaptiveServiceUnavailableError(new Error('boom'))).toBe(false);
  });

  it('recognizes pipeline-not-completed as the canonical not-ready code', () => {
    expect(isAdaptivePipelineNotReadyError(makeError('pipeline_not_completed'))).toBe(true);
    expect(isAdaptivePipelineNotReadyError(makeError('pipeline_not_found'))).toBe(false);
    expect(isAdaptivePipelineNotReadyError('pipeline_not_completed')).toBe(false);
  });
});
