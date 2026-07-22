import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reportApiErrorMock } = vi.hoisted(() => ({ reportApiErrorMock: vi.fn() }));

vi.mock('@/lib/api/error-events', () => ({ reportApiError: reportApiErrorMock }));

import { fetchAskRinAgent } from './agui-fetch';

describe('fetchAskRinAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes upgrade-eligible quota errors without consuming the HttpAgent response', async () => {
    const response = Response.json(
      {
        success: false,
        error: {
          code: 'quota_exceeded',
          message: 'Usage quota exceeded',
          detail: 'Daily quota reached',
          meta: { upgradeEligible: true },
        },
      },
      { status: 429 },
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await fetchAskRinAgent('/api/ask-rin-chan/agent', {});

    expect(result).toBe(response);
    expect(reportApiErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'quota_exceeded',
        status: 429,
        meta: { upgradeEligible: true },
      }),
    );
    await expect(result.json()).resolves.toMatchObject({
      error: { code: 'quota_exceeded' },
    });
  });

  it('leaves non-standard failures to HttpAgent without emitting a product error', async () => {
    const response = new Response('bad gateway', { status: 502 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const result = await fetchAskRinAgent('/api/ask-rin-chan/agent', {});

    expect(result).toBe(response);
    expect(reportApiErrorMock).not.toHaveBeenCalled();
    await expect(result.text()).resolves.toBe('bad gateway');
  });
});
