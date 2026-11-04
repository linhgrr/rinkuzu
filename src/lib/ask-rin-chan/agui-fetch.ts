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
  // AG-UI copies Error.message into the run status, so it never carries server text (RIN-756).
  // The UI renders copy from the code via useAskRinErrorMessage; the server text stays in detail.
  const error = new ApiResponseError({
    message: 'Ask Rin-chan request failed',
    status: response.status,
    payload: standardPayload,
    code: standardPayload ? extractApiErrorCode(standardPayload) : null,
    detail: standardPayload ? extractApiErrorMessage(standardPayload, '') || null : null,
    meta: standardPayload ? extractApiErrorMeta(standardPayload) : null,
  });
  reportApiError(error);
  throw error;
}
