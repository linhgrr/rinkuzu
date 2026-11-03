export class AdaptiveApiError extends Error {
  declare status?: number;
  declare detail?: string;
  /** Envelope `error.meta` (for example `upgradeEligible` on `quota_exceeded`). */
  declare meta?: unknown;
  /** From `Retry-After` or `meta.retryAfterSeconds`; read by `describeApiError` (RIN-754). */
  declare retryAfterSeconds?: number;
  code: string;
  retryable: boolean;

  constructor({
    message,
    code,
    status,
    detail,
    meta,
    retryAfterSeconds,
    retryable = false,
  }: {
    /** For logs only: the UI never renders it (RIN-748 contract). */
    message: string;
    code: string;
    status?: number;
    detail?: string;
    meta?: unknown;
    retryAfterSeconds?: number | null;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'AdaptiveApiError';
    if (status !== undefined) this.status = status;
    if (detail !== undefined) this.detail = detail;
    if (meta !== undefined) this.meta = meta;
    if (retryAfterSeconds !== undefined && retryAfterSeconds !== null) {
      this.retryAfterSeconds = retryAfterSeconds;
    }
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * The value to hand to `describeApiError` / `ErrorState` for an adaptive failure (RIN-754).
 * `timedFetch` reports a timeout as `request_aborted` and a dropped connection as
 * `service_unavailable` without a status; shown as-is they would render nothing or a
 * misleading "service down", so they become `upstream_timeout` and a network failure.
 */
export function adaptiveErrorForDisplay(error: unknown): unknown {
  if (!(error instanceof AdaptiveApiError)) return error;
  if (error.code === 'request_aborted') {
    return { code: 'upstream_timeout', status: error.status ?? null };
  }
  if (error.code === 'service_unavailable' && error.status === undefined) {
    return new TypeError('network');
  }
  return error;
}

type AdaptiveApiErrorWithCode<TCode extends string> = AdaptiveApiError & {
  code: TCode;
};

const ADAPTIVE_SERVICE_UNAVAILABLE_CODES = new Set([
  'service_unavailable',
  'upstream_error',
  'upstream_timeout',
  'upstream_invalid_json',
  'upstream_invalid_envelope',
  'rate_limit_exceeded',
]);

export function isRetryableAdaptiveError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError && error.retryable;
}

export function isAdaptiveApiError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError;
}

export function isAdaptiveRequestAbortedError(
  error: unknown,
): error is AdaptiveApiErrorWithCode<'request_aborted'> {
  return error instanceof AdaptiveApiError && error.code === 'request_aborted';
}

export function isAdaptiveServiceUnavailableError(
  error: unknown,
): error is AdaptiveApiErrorWithCode<
  | 'service_unavailable'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'upstream_invalid_json'
  | 'upstream_invalid_envelope'
  | 'rate_limit_exceeded'
> {
  return error instanceof AdaptiveApiError && ADAPTIVE_SERVICE_UNAVAILABLE_CODES.has(error.code);
}

export function isAdaptivePipelineNotReadyError(
  error: unknown,
): error is AdaptiveApiErrorWithCode<'pipeline_not_completed'> {
  return error instanceof AdaptiveApiError && error.code === 'pipeline_not_completed';
}

export function isSessionNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('session not found') || message.includes('session_not_found');
}
