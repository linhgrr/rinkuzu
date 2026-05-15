export class ApiResponseError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.payload = payload;
  }
}

export type ApiSuccessResponse<T, Extra extends Record<string, unknown> = Record<string, never>> = {
  success: true;
  data: T;
} & Extra;

async function parseApiBody(response: Response): Promise<{ payload: unknown; rawText: string }> {
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

/**
 * Low-level API client for callers that need the full success envelope.
 * Use this when a route returns top-level metadata like `message`.
 */
export async function fetchApiResponse<
  T,
  Extra extends Record<string, unknown> = Record<string, never>,
>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiSuccessResponse<T, Extra>> {
  const response = await fetch(input, init);
  const { payload: rawPayload, rawText } = await parseApiBody(response);

  if (response.ok && (response.status === 204 || rawPayload === null)) {
    return {
      success: true,
      data: null as T,
    } as ApiSuccessResponse<T, Extra>;
  }

  // Narrow the parsed JSON payload for property access
  const payload = rawPayload as {
    success?: boolean;
    error?: unknown;
    detail?: unknown;
    message?: unknown;
    data?: unknown;
  } | null;

  if (!response.ok || payload?.success !== true) {
    const errorObj = payload?.error;
    const errorMessage =
      typeof errorObj === 'object' && errorObj !== null
        ? String(
            (errorObj as Record<string, unknown>)['detail'] ||
              (errorObj as Record<string, unknown>)['message'] ||
              rawText,
          )
        : String(errorObj ?? payload?.detail ?? payload?.message ?? rawText);

    throw new ApiResponseError(
      errorMessage || `Request failed with status ${response.status}`,
      response.status,
      rawPayload ?? rawText,
    );
  }

  return rawPayload as ApiSuccessResponse<T, Extra>;
}

/**
 * Default client helper for UI reads and SWR usage.
 * Returns only the payload stored under `data`.
 */
export async function fetchApiData<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const result = await fetchApiResponse<T>(input, init);
  return result.data;
}
