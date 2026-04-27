import { consumeOpenAISseResponse, createStreamError, parseJsonResponse } from '@/lib/ai/stream';

export interface QuizAiChatMessage {
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

export interface QuizAskAiResponseData {
  explanation: string;
  structured: unknown | null;
  timestamp: string;
  turnCount: number;
}

interface QuizAskAiEnvelope {
  success: boolean;
  error?: string;
  data?: QuizAskAiResponseData;
}

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

export async function askQuizAI(
  payload: QuizAskAiRequest,
  signal?: AbortSignal,
): Promise<QuizAskAiResponseData> {
  const response = await requestQuizAI(payload, signal);
  const body = await parseJsonResponse<QuizAskAiEnvelope>(response);

  if (!response.ok || !body.success || !body.data) {
    throw createStreamError(body.error || `HTTP error ${response.status}`, response.status);
  }

  return body.data;
}

export async function streamQuizAI(
  payload: QuizAskAiRequest,
  options: StreamQuizAiOptions = {},
): Promise<string> {
  const response = await requestQuizAI({ ...payload, stream: true }, options.signal);
  return consumeOpenAISseResponse<QuizAskAiEnvelope>(response, {
    onContent: options.onContent,
    extractErrorMessage: (body, status) => body.error || `HTTP error ${status}`,
    extractFallbackContent: (body) => (body.success && body.data ? body.data.explanation : null),
  });
}
