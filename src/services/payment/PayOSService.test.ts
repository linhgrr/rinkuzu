import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    PAYOS_CLIENT_ID: 'client-id',
    PAYOS_API_KEY: 'api-key',
    PAYOS_CHECKSUM_KEY: 'checksum-key',
  },
}));

import { PayOSService } from '@/services/payment/PayOSService';

describe('PayOSService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: vi
          .fn()
          .mockResolvedValue(JSON.stringify({ code: '00', desc: 'success', data: null })),
      }),
    );
  });

  it('omits absent optional buyer fields from the signed payment request', async () => {
    await new PayOSService().createPayment(
      123,
      99_000,
      'ORDER 123',
      'https://example.com/return',
      'https://example.com/cancel',
    );

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') throw new Error('Expected serialized PayOS request body');
    const body: unknown = JSON.parse(init.body);
    expect(body).not.toHaveProperty('buyerEmail');
    expect(body).not.toHaveProperty('buyerName');
    expect(body).toMatchObject({
      orderCode: 123,
      amount: 99_000,
      signature: expect.any(String),
    });
  });
});
