import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    PAYOS_CLIENT_ID: 'client-id',
    PAYOS_API_KEY: 'api-key',
    PAYOS_CHECKSUM_KEY: 'checksum-key',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

import { PayOSService } from '@/services/payment/PayOSService';

function paymentCreateResponse(overrides: Record<string, unknown> = {}) {
  return {
    code: '00',
    desc: 'success',
    data: {
      bin: '970422',
      accountNumber: '123',
      accountName: 'RINKUZU',
      amount: 99_000,
      description: 'ORDER 123',
      orderCode: 123,
      currency: 'VND',
      paymentLinkId: 'plink-1',
      status: 'PENDING',
      checkoutUrl: 'https://pay.payos.vn/web/plink-1',
      qrCode: 'qr-data',
      ...overrides,
    },
  };
}

function paymentLinkResponse(overrides: Record<string, unknown> = {}) {
  return {
    code: '00',
    desc: 'success',
    data: {
      id: 'plink-1',
      orderCode: 123,
      amount: 99_000,
      amountPaid: 99_000,
      amountRemaining: 0,
      status: 'PAID',
      createdAt: '2026-07-02T04:00:00.000Z',
      transactions: [
        {
          reference: 'ref-1',
          amount: 99_000,
          accountNumber: '123',
          description: 'ORDER 123',
          transactionDateTime: '2026-07-02 11:00:00',
          virtualAccountName: null,
          virtualAccountNumber: null,
          counterAccountBankId: null,
          counterAccountBankName: null,
          counterAccountName: null,
          counterAccountNumber: null,
        },
      ],
      cancellationReason: null,
      canceledAt: null,
      ...overrides,
    },
  };
}

function mockFetch(body: unknown, init: Partial<Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    }),
  );
}

describe('PayOSService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('omits absent optional buyer fields from the signed payment request', async () => {
    mockFetch(paymentCreateResponse());

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

    const expectedSignature = crypto
      .createHmac('sha256', 'checksum-key')
      .update(
        'amount=99000&cancelUrl=https://example.com/cancel&description=ORDER 123&orderCode=123&returnUrl=https://example.com/return',
      )
      .digest('hex');
    expect((body as { signature: string }).signature).toBe(expectedSignature);
    expect(init.headers).toMatchObject({
      'x-client-id': 'client-id',
      'x-api-key': 'api-key',
    });
  });

  it('includes optional buyer fields when provided', async () => {
    mockFetch(paymentCreateResponse());

    await new PayOSService().createPayment(
      123,
      99_000,
      'ORDER 123',
      'https://example.com/return',
      'https://example.com/cancel',
      'buyer@example.com',
      'Buyer Name',
    );

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') throw new Error('Expected serialized PayOS request body');
    expect(JSON.parse(init.body)).toMatchObject({
      buyerEmail: 'buyer@example.com',
      buyerName: 'Buyer Name',
    });
  });

  it('verifies and loads payment info through GET payment-link endpoints', async () => {
    mockFetch(paymentLinkResponse());
    const service = new PayOSService();

    await expect(service.verifyPayment(123)).resolves.toMatchObject({
      code: '00',
      data: expect.objectContaining({ orderCode: 123, status: 'PAID' }),
    });
    await expect(service.getPaymentInfo(123)).resolves.toMatchObject({
      data: expect.objectContaining({ id: 'plink-1' }),
    });

    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      'https://api-merchant.payos.vn/v2/payment-requests/123',
    );
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('surfaces PayOS API error envelopes and invalid JSON bodies', async () => {
    mockFetch(
      { code: '20', desc: 'Order not found' },
      { ok: false, status: 400, statusText: 'Bad Request' },
    );
    await expect(new PayOSService().verifyPayment(1)).rejects.toThrow('Order not found');

    mockFetch('not-json');
    await expect(new PayOSService().verifyPayment(1)).rejects.toThrow(
      'Invalid response from PayOS API',
    );
  });

  it('rejects responses that violate the payment contract schema', async () => {
    mockFetch({ code: '00', desc: 'success', data: { orderCode: 'bad' } });

    await expect(new PayOSService().verifyPayment(1)).rejects.toThrow(
      'Invalid response from PayOS API',
    );
  });

  it('returns true from testConnection when credentials are present', async () => {
    await expect(new PayOSService().testConnection()).resolves.toBe(true);
  });

  it('rethrows Error instances from fetch failures and wraps unknown failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(new PayOSService().verifyPayment(1)).rejects.toThrow('network down');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('weird'));
    await expect(new PayOSService().verifyPayment(1)).rejects.toThrow(
      'Payment service is temporarily unavailable',
    );
  });
});
