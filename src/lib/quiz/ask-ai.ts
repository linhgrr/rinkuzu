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

function createQuizAskAiError(message: string, status?: number): Error {
  const error = new Error(message);

  if (typeof status === 'number') {
    (error as Error & { status?: number }).status = status;
  }

  return error;
}

async function parseQuizAskAiEnvelope(response: Response): Promise<QuizAskAiEnvelope> {
  const data = await response.json().catch(() => ({}));
  return data as QuizAskAiEnvelope;
}

function extractDeltaContent(payload: any): string {
  const deltaContent = payload?.choices?.[0]?.delta?.content;

  if (typeof deltaContent === 'string') {
    return deltaContent;
  }

  if (Array.isArray(deltaContent)) {
    return deltaContent
      .map(part => {
        if (typeof part === 'string') {
          return part;
        }

        if (part?.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }

        return '';
      })
      .join('');
  }

  if (typeof payload?.content === 'string') {
    return payload.content;
  }

  return '';
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
  signal?: AbortSignal
): Promise<QuizAskAiResponseData> {
  const response = await requestQuizAI(payload, signal);
  const body = await parseQuizAskAiEnvelope(response);

  if (!response.ok || !body.success || !body.data) {
    throw createQuizAskAiError(body.error || `HTTP error ${response.status}`, response.status);
  }

  return body.data;
}

export async function streamQuizAI(
  payload: QuizAskAiRequest,
  options: StreamQuizAiOptions = {}
): Promise<string> {
  const response = await requestQuizAI({ ...payload, stream: true }, options.signal);
  const contentType = response.headers.get('Content-Type') || '';

  if (!response.ok) {
    const body = await parseQuizAskAiEnvelope(response);
    throw createQuizAskAiError(body.error || `HTTP error ${response.status}`, response.status);
  }

  if (!contentType.includes('text/event-stream')) {
    const body = await parseQuizAskAiEnvelope(response);

    if (!body.success || !body.data) {
      throw createQuizAskAiError(body.error || 'Failed to get response', response.status);
    }

    options.onContent?.(body.data.explanation, body.data.explanation);
    return body.data.explanation;
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const dataLines = event
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim());

        if (dataLines.length === 0) {
          continue;
        }

        const data = dataLines.join('\n');

        if (data === '[DONE]') {
          return fullContent;
        }

        const parsed = JSON.parse(data);

        if (parsed.error) {
          throw new Error(typeof parsed.error === 'string' ? parsed.error : 'Streaming request failed');
        }

        if (parsed.done === true) {
          return fullContent;
        }

        const chunk = extractDeltaContent(parsed);

        if (!chunk) {
          continue;
        }

        fullContent += chunk;
        options.onContent?.(chunk, fullContent);
      }
    }

    return fullContent;
  } finally {
    reader.releaseLock();
  }
}
