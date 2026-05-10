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

export async function fetchApiSuccess<
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
    data?: unknown;
  } | null;

  if (!response.ok || payload?.success !== true) {
    const errorObj = payload?.error;
    const errorMessage =
      typeof errorObj === 'object' && errorObj !== null
        ? String(
            (errorObj as Record<string, unknown>)['message'] ||
              (errorObj as Record<string, unknown>)['detail'] ||
              rawText,
          )
        : String(errorObj || payload?.detail || rawText);

    throw new ApiResponseError(
      errorMessage || `Request failed with status ${response.status}`,
      response.status,
      rawPayload ?? rawText,
    );
  }

  return rawPayload as ApiSuccessResponse<T, Extra>;
}
