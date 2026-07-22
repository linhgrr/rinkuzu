import { ApiResponseError } from '@/lib/api/client';
import { isStandardErrorEnvelope } from '@/lib/api/envelope';
import { extractApiErrorCode, extractApiErrorMessage, extractApiErrorMeta } from '@/lib/api/error';
import { reportApiError } from '@/lib/api/error-events';

export async function fetchAskRinAgent(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.ok) return response;

  try {
    const payload: unknown = await response.clone().json();
    if (isStandardErrorEnvelope(payload)) {
      const message = extractApiErrorMessage(
        payload,
        `Request failed with status ${response.status}`,
      );
      reportApiError(
        new ApiResponseError({
          message,
          status: response.status,
          payload,
          code: extractApiErrorCode(payload),
          detail: message,
          meta: extractApiErrorMeta(payload),
        }),
      );
    }
  } catch {
    // HttpAgent remains the owner of invalid/non-JSON response handling.
  }

  return response;
}
