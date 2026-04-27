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

async function parseApiBody(response: Response): Promise<{ payload: any; rawText: string }> {
  const rawText = await response.text().catch(() => '');

  if (!rawText) {
    return { payload: null, rawText: '' };
  }

  try {
    return {
      payload: JSON.parse(rawText),
      rawText,
    };
  } catch {
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
  const { payload, rawText } = await parseApiBody(response);

  if (response.ok && (response.status === 204 || payload === null)) {
    return {
      success: true,
      data: null as T,
    } as ApiSuccessResponse<T, Extra>;
  }

  if (!response.ok || payload?.success !== true) {
    throw new ApiResponseError(
      payload?.error ||
        payload?.detail ||
        rawText ||
        `Request failed with status ${response.status}`,
      response.status,
      payload ?? rawText,
    );
  }

  return payload as ApiSuccessResponse<T, Extra>;
}
