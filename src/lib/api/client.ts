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

async function parseJsonSafely(response: Response): Promise<any> {
  return response.json().catch(() => ({}));
}

export async function fetchApiSuccess<
  T,
  Extra extends Record<string, unknown> = Record<string, never>,
>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiSuccessResponse<T, Extra>> {
  const response = await fetch(input, init);
  const payload = await parseJsonSafely(response);

  if (!response.ok || payload?.success !== true) {
    throw new ApiResponseError(
      payload?.error || `Request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return payload as ApiSuccessResponse<T, Extra>;
}
