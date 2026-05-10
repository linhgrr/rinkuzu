export class AdaptiveApiError extends Error {
  status?: number;
  detail?: string;
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
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.retryable = retryable;
  }
}

export function isRetryableAdaptiveError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError && error.retryable;
}

export function isAdaptiveApiError(error: unknown): error is AdaptiveApiError {
  return error instanceof AdaptiveApiError;
}

export function isSessionNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('session not found') || message.includes('session_not_found');
}
