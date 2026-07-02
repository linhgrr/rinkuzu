interface StreamTextOptions {
  onContent?: (chunk: string, fullContent: string) => void;
}

type ResponsesSsePayload =
  | { type: 'response.output_text.delta'; delta: string }
  | { type: 'response.completed' }
  | { type: 'response.failed'; response: { error: { message: string } } };

function createStreamError(message: string, status?: number): Error {
  const error = new Error(message);

  if (typeof status === 'number') {
    (error as Error & { status?: number }).status = status;
  }

  return error;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    console.warn('parseJsonResponse: response body is not valid JSON');
    return null;
  }
}

function splitSseEvents(buffer: string): { events: string[]; remaining: string } {
  const events: string[] = [];
  const delimiter = /\r?\n\r?\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = delimiter.exec(buffer)) !== null) {
    events.push(buffer.slice(lastIndex, match.index));
    lastIndex = delimiter.lastIndex;
  }

  return {
    events,
    remaining: buffer.slice(lastIndex),
  };
}

function isResponsesSsePayload(payload: unknown): payload is ResponsesSsePayload {
  if (!payload || typeof payload !== 'object' || !('type' in payload)) {
    return false;
  }

  if (payload.type === 'response.completed') {
    return true;
  }

  if (payload.type === 'response.output_text.delta') {
    return 'delta' in payload && typeof payload.delta === 'string';
  }

  if (payload.type !== 'response.failed' || !('response' in payload)) {
    return false;
  }

  const response = payload.response;
  if (!response || typeof response !== 'object' || !('error' in response)) {
    return false;
  }

  const error = response.error;
  return (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

function parseSseEvent(event: string): {
  chunk: string;
  isTerminal: boolean;
} {
  const dataLines: string[] = [];

  for (const line of event.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return { chunk: '', isTerminal: false };
  }

  const data = dataLines.join('\n');

  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch {
    throw createStreamError('Streaming response contained invalid SSE payload');
  }

  if (!isResponsesSsePayload(parsed)) {
    throw createStreamError('Streaming response contained an unsupported SSE event');
  }

  if (parsed.type === 'response.failed') {
    throw createStreamError(parsed.response.error.message);
  }

  if (parsed.type === 'response.completed') {
    return { chunk: '', isTerminal: true };
  }

  return {
    chunk: parsed.delta,
    isTerminal: false,
  };
}

interface ConsumeOpenAISseOptions extends StreamTextOptions {
  extractErrorMessage: (body: unknown, status: number) => string;
}

export async function consumeOpenAISseResponse(
  response: Response,
  options: ConsumeOpenAISseOptions,
): Promise<string> {
  const contentType = response.headers.get('Content-Type');

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    throw createStreamError(options.extractErrorMessage(body, response.status), response.status);
  }

  if (!contentType?.includes('text/event-stream')) {
    throw createStreamError('Streaming response has an invalid content type', response.status);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let sawTerminalEvent = false;

  try {
    const consumeReader = async (): Promise<void> => {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = splitSseEvents(buffer);
      buffer = remaining;

      for (const event of events) {
        const { chunk, isTerminal } = parseSseEvent(event);

        if (!chunk) {
          if (isTerminal) {
            sawTerminalEvent = true;
          }
          continue;
        }

        fullContent += chunk;
        options.onContent?.(chunk, fullContent);

        if (isTerminal) {
          sawTerminalEvent = true;
        }
      }

      await consumeReader();
    };

    await consumeReader();

    buffer += decoder.decode();

    const { events, remaining } = splitSseEvents(buffer);
    for (const event of events) {
      const { chunk, isTerminal } = parseSseEvent(event);

      if (chunk) {
        fullContent += chunk;
        options.onContent?.(chunk, fullContent);
      }

      if (isTerminal) {
        sawTerminalEvent = true;
      }
    }

    if (remaining.trim()) {
      const { chunk, isTerminal } = parseSseEvent(remaining);

      if (chunk) {
        fullContent += chunk;
        options.onContent?.(chunk, fullContent);
      }

      if (isTerminal) {
        sawTerminalEvent = true;
      }
    }

    if (!sawTerminalEvent) {
      throw createStreamError('Streaming response ended before completion signal');
    }

    if (!fullContent.trim()) {
      throw createStreamError('Streaming response completed without content');
    }

    return fullContent;
  } finally {
    reader.releaseLock();
  }
}
