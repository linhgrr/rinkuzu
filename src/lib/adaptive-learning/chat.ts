import { consumeOpenAISseResponse } from '@/lib/ai/stream';

export interface AdaptiveTutorChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdaptiveTutorChatRequest {
  userQuestion: string;
  chatHistory?: AdaptiveTutorChatMessage[];
}

interface AdaptiveTutorChatResponse {
  explanation?: string;
  detail?: string;
  error?: string;
}

interface StreamAdaptiveTutorChatOptions {
  signal?: AbortSignal;
  onContent?: (chunk: string, fullContent: string) => void;
}

export async function streamAdaptiveTutorChat(
  sessionId: string,
  payload: AdaptiveTutorChatRequest,
  options: StreamAdaptiveTutorChatOptions = {}
): Promise<string> {
  const response = await fetch(`/api/adaptive-learning/session/${sessionId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal: options.signal,
  });

  return consumeOpenAISseResponse<AdaptiveTutorChatResponse>(response, {
    onContent: options.onContent,
    extractErrorMessage: (body, status) => body.detail || body.error || `HTTP error ${status}`,
    extractFallbackContent: body => body.explanation,
  });
}
