import {
  extractApiErrorCode,
  extractApiErrorMessage,
  extractApiErrorMeta,
  type ApiErrorPayload,
} from './error';

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
> = {
  success: true;
  data: T;
  meta?: Meta;
};

type ParsedApiBody = { payload: unknown; rawText: string };

type StandardSuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

function isStandardSuccessEnvelope<T>(payload: unknown): payload is StandardSuccessEnvelope<T> {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as { success?: unknown }).success === true &&
    'data' in payload
  );
}

function isStandardErrorEnvelope(payload: unknown): payload is ApiErrorPayload {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as { success?: unknown }).success === false &&
    'error' in payload
  );
}

async function parseApiBody(response: Response): Promise<ParsedApiBody> {
  let rawText: string;
  try {
    rawText = await response.text();
  } catch (bodyError) {
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
  return new ApiResponseError({
    message: 'Invalid API response envelope',
    status,
    payload: payload ?? rawText,
    code: 'invalid_response_envelope',
    detail: rawText || null,
  });
}

/**
 * Low-level API client for callers that need the full success envelope.
 */
export async function fetchApiResponse<
  T,
  Meta extends Record<string, unknown> = Record<string, unknown>,
>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiSuccessResponse<T, Meta>> {
  const response = await fetch(input, init);

  if (response.status === 204) {
    return {
      success: true,
      data: null as T,
    } as ApiSuccessResponse<T, Meta>;
  }

  const { payload: rawPayload, rawText } = await parseApiBody(response);

  if (response.ok && isStandardSuccessEnvelope<T>(rawPayload)) {
    return rawPayload as ApiSuccessResponse<T, Meta>;
  }

  if (isStandardErrorEnvelope(rawPayload)) {
    const message = extractApiErrorMessage(
      rawPayload,
      `Request failed with status ${response.status}`,
    );
    throw new ApiResponseError({
      message,
      status: response.status,
      payload: rawPayload,
      code: extractApiErrorCode(rawPayload),
      detail: message,
      meta: extractApiErrorMeta(rawPayload),
    });
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
