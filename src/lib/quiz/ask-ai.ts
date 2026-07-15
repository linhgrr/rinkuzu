import { consumeOpenAISseResponse } from '@/lib/ai/stream';
import { extractApiErrorMessage } from '@/lib/api/error';
import { QuizTutorRequestMapper } from '@/mappers/quiz/QuizTutorRequestMapper';
import type { QuizTutorStreamRequestDto } from '@/dtos/quiz-tutor';
import type { components } from '@/generated/adaptive-api';

type QuizTutorRequest = components['schemas']['QuizTutorRequest'];

interface StreamQuizAiOptions {
  signal?: AbortSignal;
  onContent?: (chunk: string, fullContent: string) => void;
}

async function requestQuizAI(payload: QuizTutorRequest, signal?: AbortSignal): Promise<Response> {
  return fetch('/api/quiz/ask-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(signal !== undefined ? { signal } : {}),
  });
}

function extractQuizAiErrorMessage(body: unknown, status: number): string {
  return extractApiErrorMessage(body, `HTTP error ${status}`);
}

export async function streamQuizAI(
  payload: QuizTutorStreamRequestDto,
  options: StreamQuizAiOptions = {},
): Promise<string> {
  const response = await requestQuizAI(
    QuizTutorRequestMapper.toApiRequest(payload),
    options.signal,
  );
  return consumeOpenAISseResponse(response, {
    ...(options.onContent !== undefined ? { onContent: options.onContent } : {}),
    extractErrorMessage: extractQuizAiErrorMessage,
  });
}
