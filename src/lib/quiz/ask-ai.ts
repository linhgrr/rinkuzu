import { consumeOpenAISseResponse } from '@/lib/ai/stream';

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
  turn_count: number;
}

interface QuizAskAiErrorDetail {
  code?: string;
  message?: string;
  detail?: string;
  meta?: unknown;
}

interface QuizAskAiEnvelope {
  success: boolean;
  error?: string | QuizAskAiErrorDetail;
  detail?: string;
  message?: string;
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

function extractQuizAiErrorMessage(body: QuizAskAiEnvelope, status: number): string {
  if (typeof body.error === 'string' && body.error.trim()) {
    return body.error.trim();
  }

  if (body.error && typeof body.error === 'object') {
    const detail = typeof body.error.detail === 'string' ? body.error.detail.trim() : '';
    const message = typeof body.error.message === 'string' ? body.error.message.trim() : '';
    const code = typeof body.error.code === 'string' ? body.error.code.trim() : '';

    if (detail) return detail;
    if (message) return message;
    if (code) return code;
  }

  if (typeof body.detail === 'string' && body.detail.trim()) {
    return body.detail.trim();
  }

  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }

  return `HTTP error ${status}`;
}

export async function streamQuizAI(
  payload: QuizAskAiRequest,
  options: StreamQuizAiOptions = {},
): Promise<string> {
  const response = await requestQuizAI({ ...payload, stream: true }, options.signal);
  return consumeOpenAISseResponse<QuizAskAiEnvelope>(response, {
    onContent: options.onContent,
    extractErrorMessage: extractQuizAiErrorMessage,
    extractFallbackContent: (body) => (body.success && body.data ? body.data.explanation : null),
  });
}
