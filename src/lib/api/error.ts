type ApiErrorObject = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  meta?: unknown;
};

export type ApiErrorPayload = {
  success?: unknown;
  error?: unknown;
  detail?: unknown;
  message?: unknown;
};

export function extractApiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
): string {
  if (payload && typeof payload === 'object') {
    const error = payload.error;

    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }

    if (error && typeof error === 'object') {
      const errorObject = error as ApiErrorObject;
      const detail = typeof errorObject.detail === 'string' ? errorObject.detail.trim() : '';
      const message = typeof errorObject.message === 'string' ? errorObject.message.trim() : '';
      const code = typeof errorObject.code === 'string' ? errorObject.code.trim() : '';

      if (detail) return detail;
      if (message) return message;
      if (code) return code;
    }

    const detail = typeof payload.detail === 'string' ? payload.detail.trim() : '';
    const message = typeof payload.message === 'string' ? payload.message.trim() : '';

    if (detail) return detail;
    if (message) return message;
  }

  return fallback;
}

export function extractUnknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export function buildStandardErrorBody(
  code: string,
  detail: string,
  extras?: Record<string, unknown>,
  message: string = 'Request failed',
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      detail,
    },
    ...(extras ?? {}),
  };
}
