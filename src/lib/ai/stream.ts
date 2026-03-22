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

interface ConsumeOpenAISseOptions<TBody> extends StreamTextOptions {
  extractErrorMessage: (body: TBody, status: number) => string;
  extractFallbackContent: (body: TBody) => string | null | undefined;
}

export async function consumeOpenAISseResponse<TBody>(
  response: Response,
  options: ConsumeOpenAISseOptions<TBody>
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

        const chunk = extractOpenAIDeltaContent(parsed);

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
