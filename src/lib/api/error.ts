type ApiErrorObject = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  meta?: unknown;
};

export type ApiErrorPayload = {
  success?: unknown;
  error?: unknown;
};

export type StandardErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    detail?: string;
    meta?: Record<string, unknown> | Array<Record<string, unknown>>;
  };
};

function readErrorObject(payload: ApiErrorPayload | null | undefined): ApiErrorObject | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = payload.error;
  if (!error || typeof error !== 'object') return null;
  return error as ApiErrorObject;
}

export function extractApiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
): string {
  const errorObject = readErrorObject(payload);
  if (!errorObject) {
    return fallback;
  }

  const detail = typeof errorObject.detail === 'string' ? errorObject.detail.trim() : '';
  const message = typeof errorObject.message === 'string' ? errorObject.message.trim() : '';
  const code = typeof errorObject.code === 'string' ? errorObject.code.trim() : '';

  if (detail) return detail;
  if (message) return message;
  if (code) return code;
  return fallback;
}

export function extractApiErrorCode(payload: ApiErrorPayload | null | undefined): string | null {
  const errorObject = readErrorObject(payload);
  if (!errorObject) return null;
  return typeof errorObject.code === 'string' && errorObject.code.trim()
    ? errorObject.code.trim()
    : null;
}

export function extractApiErrorMeta<T = unknown>(
  payload: ApiErrorPayload | null | undefined,
): T | null {
  const errorObject = readErrorObject(payload);
  if (!errorObject) return null;
  return (errorObject.meta as T | undefined) ?? null;
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

export function buildStandardErrorBody({
  code,
  message,
  detail,
  meta,
}: {
  code: string;
  message: string;
  detail?: string;
  meta?: Record<string, unknown> | Array<Record<string, unknown>>;
}): StandardErrorBody {
  return {
    success: false,
    error: {
      code,
      message,
      ...(detail ? { detail } : {}),
      ...(meta !== undefined ? { meta } : {}),
    },
  };
}
