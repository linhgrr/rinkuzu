import { consumeOpenAISseResponse } from '@/lib/ai/stream';
import type { ApiSuccessResponse } from '@/lib/api/client';
import { extractApiErrorMessage, type ApiErrorPayload } from '@/lib/api/error';

interface QuizAiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuizAskAiRequest {
  question: string;
  options: string[];
  userQuestion?: string;
  questionImage?: string;
  optionImages?: (string | undefined)[];
  chatHistory?: QuizAiChatMessage[];
  stream?: boolean;
}

interface QuizAskAiResponseData {
  explanation: string;
  structured: unknown | null;
  timestamp: string;
  turn_count: number;
}

type QuizAskAiEnvelope = ApiSuccessResponse<QuizAskAiResponseData> | ApiErrorPayload;

interface StreamQuizAiOptions {
  signal?: AbortSignal;
  onContent?: (chunk: string, fullContent: string) => void;
}

async function requestQuizAI(payload: QuizAskAiRequest, signal?: AbortSignal): Promise<Response> {
  return fetch('/api/quiz/ask-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

function extractQuizAiErrorMessage(body: QuizAskAiEnvelope, status: number): string {
  return extractApiErrorMessage(body, `HTTP error ${status}`);
}

export async function streamQuizAI(
  payload: QuizAskAiRequest,
  options: StreamQuizAiOptions = {},
): Promise<string> {
  const response = await requestQuizAI({ ...payload, stream: true }, options.signal);
  return consumeOpenAISseResponse<QuizAskAiEnvelope>(response, {
    onContent: options.onContent,
    extractErrorMessage: extractQuizAiErrorMessage,
    extractFallbackContent: (body) =>
      body.success === true && 'data' in body ? body.data?.explanation : null,
  });
}
