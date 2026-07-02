import { isRecord, type StandardErrorEnvelope } from '@/lib/api/envelope';

type ApiErrorObject = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  meta?: unknown;
};

export type ApiErrorPayload = StandardErrorEnvelope;

type StandardErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    detail?: string;
    meta?: Record<string, unknown> | Array<Record<string, unknown>>;
  };
};

function readErrorObject(payload: unknown): ApiErrorObject | null {
  if (!isRecord(payload)) return null;
  const error = payload['error'];
  if (!isRecord(error)) return null;
  return error;
}

export function extractApiErrorMessage(payload: unknown, defaultMessage: string): string {
  const errorObject = readErrorObject(payload);
  if (!errorObject) {
    return defaultMessage;
  }

  const detail = typeof errorObject.detail === 'string' ? errorObject.detail.trim() : '';
  const message = typeof errorObject.message === 'string' ? errorObject.message.trim() : '';
  const code = typeof errorObject.code === 'string' ? errorObject.code.trim() : '';

  if (detail) return detail;
  if (message) return message;
  if (code) return code;
  return defaultMessage;
}

export function extractApiErrorCode(payload: unknown): string | null {
  const errorObject = readErrorObject(payload);
  if (!errorObject) return null;
  return typeof errorObject.code === 'string' && errorObject.code.trim()
    ? errorObject.code.trim()
    : null;
}

export function extractApiErrorMeta<T = unknown>(payload: unknown): T | null {
  const errorObject = readErrorObject(payload);
  if (!errorObject) return null;
  return (errorObject.meta as T | undefined) ?? null;
}

export function extractUnknownErrorMessage(error: unknown, defaultMessage: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }

  return defaultMessage;
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
