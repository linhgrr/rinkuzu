import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToApiErrors } from '@/lib/api/error-events';
import { consumeOpenAISseResponse } from './stream';

function createSseResponse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const options = {
  extractErrorMessage: (_body: unknown, status: number) => `HTTP error ${status}`,
};

describe('consumeOpenAISseResponse', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consumes the exact Responses SSE protocol emitted by the backend', async () => {
    const onContent = vi.fn();
    const response = createSseResponse([
      { type: 'response.output_text.delta', delta: 'Hello' },
      { type: 'response.output_text.delta', delta: ' world' },
      { type: 'response.completed' },
    ]);

    await expect(consumeOpenAISseResponse(response, { ...options, onContent })).resolves.toBe(
      'Hello world',
    );
    expect(onContent).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
    expect(onContent).toHaveBeenNthCalledWith(2, ' world', 'Hello world');
  });

  it.each([
    ['legacy completion sentinel', 'data: [DONE]\n\n'],
    [
      'legacy chat-completions event',
      `data: ${JSON.stringify({
        choices: [{ delta: { content: 'legacy' }, finish_reason: null }],
      })}\n\n`,
    ],
  ])('rejects the %s protocol', async (_label, body) => {
    const response = new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    await expect(consumeOpenAISseResponse(response, options)).rejects.toThrow(
      /invalid SSE payload|unsupported SSE event/,
    );
  });

  it('rejects a JSON success response when streaming was requested', async () => {
    const response = new Response(
      JSON.stringify({ success: true, data: { explanation: 'non-stream response' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(consumeOpenAISseResponse(response, options)).rejects.toThrow(
      'Streaming response has an invalid content type',
    );
  });

  it('rejects a completed stream without content', async () => {
    const response = createSseResponse([{ type: 'response.completed' }]);

    await expect(consumeOpenAISseResponse(response, options)).rejects.toThrow(
      'Streaming response completed without content',
    );
  });

  it('surfaces the backend failure event', async () => {
    const response = createSseResponse([
      {
        type: 'response.failed',
        response: { error: { message: 'Tutor backend failed' } },
      },
    ]);

    await expect(consumeOpenAISseResponse(response, options)).rejects.toThrow(
      'Tutor backend failed',
    );
  });

  it('reports entitlement errors from non-stream responses', async () => {
    vi.stubGlobal('window', {});
    const listener = vi.fn();
    const unsubscribe = subscribeToApiErrors(listener);
    const response = new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'quota_exceeded',
          message: 'Usage quota exceeded',
          meta: { tier: 'free', upgradeEligible: true },
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(consumeOpenAISseResponse(response, options)).rejects.toMatchObject({
      name: 'ApiResponseError',
      code: 'quota_exceeded',
      meta: { tier: 'free', upgradeEligible: true },
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
