import { afterEach, describe, expect, it, vi } from 'vitest';
import { timedFetch } from '@/features/adaptive/lib/adaptive-api-fetch';

describe('timedFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps native AbortSignal timeout failures to the aborted request contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')),
    );

    await expect(timedFetch('/api/adaptive/health', { timeoutMs: 10 })).rejects.toMatchObject({
      code: 'request_aborted',
      retryable: true,
    });
  });

  it('combines a caller signal with the native timeout signal', async () => {
    const caller = new AbortController();
    const received: { signal?: AbortSignal } = {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        received.signal = init.signal as AbortSignal;
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }),
    );

    const request = timedFetch('/api/adaptive/health', {
      timeoutMs: 10_000,
      signal: caller.signal,
    });
    caller.abort();

    await expect(request).rejects.toMatchObject({ code: 'request_aborted' });
    expect(received.signal?.aborted).toBe(true);
  });
});
