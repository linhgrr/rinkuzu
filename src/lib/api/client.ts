import { extractApiErrorCode, extractApiErrorMessage, extractApiErrorMeta } from './error';
import {
  isStandardErrorEnvelope,
  isStandardSuccessEnvelope,
  type StandardSuccessEnvelope,
} from './envelope';
import { reportApiError } from './error-events';

export class ApiResponseError extends Error {
  status: number;
  payload: unknown;
  code: string | null;
  detail: string | null;
  meta: unknown;

  constructor({
    message,
    status,
    payload,
    code,
    detail,
    meta,
  }: {
    message: string;
    status: number;
    payload: unknown;
    code?: string | null;
    detail?: string | null;
    meta?: unknown;
  }) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.payload = payload;
    this.code = code ?? null;
    this.detail = detail ?? null;
    this.meta = meta ?? null;
  }
}

export type ApiSuccessResponse<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
> = StandardSuccessEnvelope<T, Meta>;

type ParsedApiBody = { payload: unknown; rawText: string };

async function parseApiBody(response: Response): Promise<ParsedApiBody> {
  let rawText: string;
  try {
    rawText = await response.text();
  } catch (bodyError) {
    // Client-safe module: cannot import the pino logger (server-only).
    console.error('parseApiBody: failed to read response body', bodyError);
    return { payload: null, rawText: '' };
  }

  if (!rawText) {
    return { payload: null, rawText: '' };
  }

  try {
    return {
      payload: JSON.parse(rawText),
      rawText,
    };
  } catch {
    console.warn(
      `parseApiBody: response body is not valid JSON, body starts with: ${rawText.slice(0, 200)}`,
    );
    return {
      payload: null,
      rawText,
    };
  }
}

function invalidEnvelopeError(status: number, payload: unknown, rawText: string): ApiResponseError {
  const error = new ApiResponseError({
    message: 'Invalid API response envelope',
    status,
    payload: payload ?? rawText,
    code: 'invalid_response_envelope',
    detail: rawText || null,
  });
  reportApiError(error);
  return error;
}

/**
 * Low-level API client for callers that need the full success envelope.
 */
export async function fetchApiResponse<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiSuccessResponse<T, Meta>> {
  const response = await fetch(input, init);

  const { payload: rawPayload, rawText } = await parseApiBody(response);

  if (response.ok && isStandardSuccessEnvelope<T, Meta>(rawPayload)) {
    return rawPayload;
  }

  if (isStandardErrorEnvelope(rawPayload)) {
    const message = extractApiErrorMessage(
      rawPayload,
      `Request failed with status ${response.status}`,
    );
    const error = new ApiResponseError({
      message,
      status: response.status,
      payload: rawPayload,
      code: extractApiErrorCode(rawPayload),
      detail: message,
      meta: extractApiErrorMeta(rawPayload),
    });
    reportApiError(error);
    throw error;
  }

  throw invalidEnvelopeError(response.status, rawPayload, rawText);
}

/**
 * Default client helper for UI reads and SWR usage.
 * Returns only the payload stored under `data`.
 */
export async function fetchApiData<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const result = await fetchApiResponse<T>(input, init);
  return result.data;
}
