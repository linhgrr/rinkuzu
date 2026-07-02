import { consumeOpenAISseResponse } from '@/lib/ai/stream';
import { extractApiErrorMessage } from '@/lib/api/error';
import type { components } from '@/generated/adaptive-api';

type AdaptiveTutorChatRequest = Omit<components['schemas']['TutorChatRequest'], 'stream'>;

interface StreamAdaptiveTutorChatOptions {
  signal?: AbortSignal;
  onContent?: (chunk: string, fullContent: string) => void;
}

export async function streamAdaptiveTutorChat(
  sessionId: string,
  payload: AdaptiveTutorChatRequest,
  options: StreamAdaptiveTutorChatOptions = {},
): Promise<string> {
  const response = await fetch(`/api/adaptive/session/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: options.signal,
  });

  return consumeOpenAISseResponse(response, {
    onContent: options.onContent,
    extractErrorMessage: (body, status) => extractApiErrorMessage(body, `HTTP error ${status}`),
  });
}
