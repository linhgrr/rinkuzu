import { ApiResponseError } from '@/lib/api/client';
import { isStandardErrorEnvelope } from '@/lib/api/envelope';
import { extractApiErrorCode, extractApiErrorMessage, extractApiErrorMeta } from '@/lib/api/error';
import { reportApiError } from '@/lib/api/error-events';

export async function fetchAskRinAgent(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.ok) return response;

  let payload: unknown = null;
  try {
    payload = await response.clone().json();
  } catch {
    // Non-JSON upstream bodies are deliberately not exposed through the chat UI.
  }

  const standardPayload = isStandardErrorEnvelope(payload) ? payload : null;
  const message = standardPayload
    ? extractApiErrorMessage(standardPayload, 'Ask Rin-chan request failed')
    : 'Ask Rin-chan request failed';
  const error = new ApiResponseError({
    message,
    status: response.status,
    payload: standardPayload,
    code: standardPayload ? extractApiErrorCode(standardPayload) : null,
    detail: standardPayload ? message : null,
    meta: standardPayload ? extractApiErrorMeta(standardPayload) : null,
  });
  reportApiError(error);
  throw error;
}
