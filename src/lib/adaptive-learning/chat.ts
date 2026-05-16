import { consumeOpenAISseResponse } from '@/lib/ai/stream';
import type { ApiSuccessResponse } from '@/lib/api/client';
import { extractApiErrorMessage, type ApiErrorPayload } from '@/lib/api/error';

interface AdaptiveTutorChatRequest {
  userQuestion: string;
}

interface AdaptiveTutorChatResponseData {
  explanation?: string;
}

type AdaptiveTutorChatEnvelope =
  | ApiSuccessResponse<AdaptiveTutorChatResponseData>
  | ApiErrorPayload;

interface StreamAdaptiveTutorChatOptions {
  signal?: AbortSignal;
  onContent?: (chunk: string, fullContent: string) => void;
}

export async function streamAdaptiveTutorChat(
  sessionId: string,
  payload: AdaptiveTutorChatRequest,
  options: StreamAdaptiveTutorChatOptions = {},
): Promise<string> {
  const response = await fetch(`/api/adaptive-learning/session/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: options.signal,
  });

  return consumeOpenAISseResponse<AdaptiveTutorChatEnvelope>(response, {
    onContent: options.onContent,
    extractErrorMessage: (body, status) => extractApiErrorMessage(body, `HTTP error ${status}`),
    extractFallbackContent: (body) =>
      body.success === true && 'data' in body ? body.data?.explanation : null,
  });
}
