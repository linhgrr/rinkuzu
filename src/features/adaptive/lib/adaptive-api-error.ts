export class AdaptiveApiError extends Error {
  declare status?: number;
  declare detail?: string;
  code: string;
  retryable: boolean;

  constructor({
    message,
    code,
    status,
    detail,
    retryable = false,
  }: {
    message: string;
    code: string;
    status?: number;
    detail?: string;
    retryable?: boolean;
  }) {
    super(message);
    this.name = 'AdaptiveApiError';
    if (status !== undefined) this.status = status;
    if (detail !== undefined) this.detail = detail;
    this.code = code;
    this.retryable = retryable;
  }
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
