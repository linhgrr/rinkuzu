export interface StreamTextOptions {
  onContent?: (chunk: string, fullContent: string) => void;
}

export function createStreamError(message: string, status?: number): Error {
  const error = new Error(message);

  if (typeof status === 'number') {
    (error as Error & { status?: number }).status = status;
  }

  return error;
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  return data as T;
}

export function extractOpenAIDeltaContent(payload: any): string {
  const deltaContent = payload?.choices?.[0]?.delta?.content;

  if (typeof deltaContent === 'string') {
    return deltaContent;
  }

  if (Array.isArray(deltaContent)) {
    return deltaContent
      .map((part) => {
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

function isTerminalOpenAIEvent(payload: any): boolean {
  if (payload?.done === true) {
    return true;
  }

  const finishReason = payload?.choices?.[0]?.finish_reason;
  return finishReason !== undefined && finishReason !== null;
}

function parseSseEvent(event: string): {
  chunk: string;
  isTerminal: boolean;
} {
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return { chunk: '', isTerminal: false };
  }

  const data = dataLines.join('\n');

  if (data === '[DONE]') {
    return { chunk: '', isTerminal: true };
  }

  let parsed: any;

  try {
    parsed = JSON.parse(data);
  } catch {
    throw createStreamError('Streaming response contained invalid SSE payload');
  }

  if (parsed?.error) {
    throw createStreamError(
      typeof parsed.error === 'string' ? parsed.error : 'Streaming request failed',
    );
  }

  return {
    chunk: extractOpenAIDeltaContent(parsed),
    isTerminal: isTerminalOpenAIEvent(parsed),
  };
}

interface ConsumeOpenAISseOptions<TBody> extends StreamTextOptions {
  extractErrorMessage: (body: TBody, status: number) => string;
  extractFallbackContent: (body: TBody) => string | null | undefined;
}

export async function consumeOpenAISseResponse<TBody>(
  response: Response,
  options: ConsumeOpenAISseOptions<TBody>,
): Promise<string> {
  const contentType = response.headers.get('Content-Type') || '';

  if (!response.ok) {
    const body = await parseJsonResponse<TBody>(response);
    throw createStreamError(options.extractErrorMessage(body, response.status), response.status);
  }

  if (!contentType.includes('text/event-stream')) {
    const body = await parseJsonResponse<TBody>(response);
    const fallbackContent = options.extractFallbackContent(body);

    if (!fallbackContent) {
      throw createStreamError(options.extractErrorMessage(body, response.status), response.status);
    }

    options.onContent?.(fallbackContent, fallbackContent);
    return fallbackContent;
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
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
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
    }

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

    return fullContent;
  } finally {
    reader.releaseLock();
  }
}
