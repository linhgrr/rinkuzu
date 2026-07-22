import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reportApiErrorMock } = vi.hoisted(() => ({ reportApiErrorMock: vi.fn() }));

vi.mock('@/lib/api/error-events', () => ({ reportApiError: reportApiErrorMock }));

import { fetchAskRinAgent } from './agui-fetch';

describe('fetchAskRinAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes and throws a typed upgrade-eligible quota error', async () => {
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

    await expect(fetchAskRinAgent('/api/ask-rin-chan/agent', {})).rejects.toMatchObject({
      code: 'quota_exceeded',
      status: 429,
      meta: { upgradeEligible: true },
    });
    expect(reportApiErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'quota_exceeded',
        status: 429,
        meta: { upgradeEligible: true },
      }),
    );
  });

  it('sanitizes non-standard failures instead of exposing their response body', async () => {
    const response = new Response('bad gateway', { status: 502 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(fetchAskRinAgent('/api/ask-rin-chan/agent', {})).rejects.toMatchObject({
      message: 'Ask Rin-chan request failed',
      status: 502,
      payload: null,
      code: null,
    });
    expect(reportApiErrorMock).toHaveBeenCalledOnce();
  });
});
