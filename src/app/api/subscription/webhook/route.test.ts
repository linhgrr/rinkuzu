import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { activateVerifiedSubscriptionMock, createSubscriptionServiceMock, loggerErrorMock } =
  vi.hoisted(() => ({
    activateVerifiedSubscriptionMock: vi.fn(),
    createSubscriptionServiceMock: vi.fn(),
    loggerErrorMock: vi.fn(),
  }));

vi.mock('@/lib/subscription-factory', () => ({
  createSubscriptionService: createSubscriptionServiceMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock },
}));

import { POST } from '@/app/api/subscription/webhook/route';

const CHECKSUM_KEY = 'test-checksum-key';

function sign(data: Record<string, unknown>, key = CHECKSUM_KEY): string {
  const payload = Object.keys(data)
    .filter((field) => data[field] !== undefined)
    .sort()
    .map((field) => {
      const rawValue = data[field];
      const value = Array.isArray(rawValue)
        ? JSON.stringify(
            rawValue.map((item) =>
              typeof item === 'object' && item !== null && !Array.isArray(item)
                ? Object.fromEntries(
                    Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
                  )
                : item,
            ),
          )
        : rawValue === null ||
            rawValue === undefined ||
            rawValue === 'null' ||
            rawValue === 'undefined'
          ? ''
          : String(rawValue);
      return `${field}=${value}`;
    })
    .join('&');
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

function webhookRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/subscription/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/subscription/webhook', () => {
  const originalChecksum = process.env['PAYOS_CHECKSUM_KEY'];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['PAYOS_CHECKSUM_KEY'] = CHECKSUM_KEY;
    createSubscriptionServiceMock.mockReturnValue({
      activateVerifiedSubscription: activateVerifiedSubscriptionMock,
    });
    activateVerifiedSubscriptionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalChecksum === undefined) {
      delete process.env['PAYOS_CHECKSUM_KEY'];
    } else {
      process.env['PAYOS_CHECKSUM_KEY'] = originalChecksum;
    }
  });

  it('fails closed when the webhook is not configured', async () => {
    delete process.env['PAYOS_CHECKSUM_KEY'];

    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: { orderCode: 1, amount: 1000 },
        signature: 'deadbeef',
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'configuration_error', detail: 'Webhook is not configured' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid request bodies before signature checks', async () => {
    const response = await POST(webhookRequest({ signature: '' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: {
        code: 'validation_error',
      },
    });
    expect(body.error.detail?.length ?? body.error.message?.length).toBeGreaterThan(0);
    expect(body.error.issues ?? body.error.fields ?? body.error.meta?.issues).toBeDefined();
  });

  it('rejects invalid signatures with timing-safe comparison', async () => {
    const data = { orderCode: 123, amount: 99_000, reference: 'ref-1' };
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: sign(data, 'wrong-key'),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid signature' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects signatures that are not SHA-256 hex digests', async () => {
    const data = { orderCode: 55, amount: 1000 };
    const shortSignature = sign(data).slice(0, 16);
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: shortSignature,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('ignores non-successful payment notifications after signature validation', async () => {
    const data = { orderCode: 123, amount: 99_000 };
    const failedSuccess = await POST(
      webhookRequest({
        code: '00',
        desc: 'failed',
        success: false,
        data,
        signature: sign(data),
      }),
    );
    const failedCode = await POST(
      webhookRequest({
        code: '01',
        desc: 'failed',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(failedSuccess.status).toBe(200);
    expect(failedCode.status).toBe(200);
    await expect(failedSuccess.json()).resolves.toMatchObject({
      meta: { message: 'Webhook ignored' },
    });
    await expect(failedCode.json()).resolves.toMatchObject({
      meta: { message: 'Webhook ignored' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe or missing order codes and amounts', async () => {
    const invalidOrder = { orderCode: 0, amount: 1000 };
    const negativeOrder = { orderCode: -5, amount: 1000 };
    const missingAmount = { orderCode: 42 };
    const missingOrder = { amount: 1000 };
    const invalidOrderResponse = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: invalidOrder,
        signature: sign(invalidOrder),
      }),
    );
    const negativeOrderResponse = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: negativeOrder,
        signature: sign(negativeOrder),
      }),
    );
    const missingAmountResponse = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: missingAmount,
        signature: sign(missingAmount),
      }),
    );
    const missingOrderResponse = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: missingOrder,
        signature: sign(missingOrder),
      }),
    );

    expect(invalidOrderResponse.status).toBe(400);
    await expect(invalidOrderResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid order code' },
    });
    expect(negativeOrderResponse.status).toBe(400);
    await expect(negativeOrderResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid order code' },
    });
    expect(missingAmountResponse.status).toBe(400);
    await expect(missingAmountResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid payment amount' },
    });
    expect(missingOrderResponse.status).toBe(400);
    await expect(missingOrderResponse.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects an empty transaction reference after validating its signature', async () => {
    const data = { orderCode: 321, amount: 10_000, reference: '', extra: undefined };
    const signedData = { orderCode: 321, amount: 10_000, reference: '' };
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data: signedData,
        signature: sign(signedData),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid payment reference' },
    });
    expect(sign({ ...signedData, reference: 'x' })).not.toBe(sign(signedData));
    void data;
  });

  it('activates a fully verified PayOS webhook', async () => {
    const data = {
      orderCode: 456,
      amount: 120_000,
      reference: 'payos-ref',
      code: '00',
      items: [{ name: 'Premium', price: 120_000 }],
    };
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(200);
    expect(activateVerifiedSubscriptionMock).toHaveBeenCalledWith(456, {
      orderCode: 456,
      amount: 120_000,
      reference: 'payos-ref',
    });
  });

  it('rejects missing required PayOS transaction identifiers', async () => {
    const data = { orderCode: 789, amount: 50_000 };
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid payment reference' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects a non-success payment code inside signed data', async () => {
    const data = { orderCode: 790, amount: 50_000, reference: 'ref-790', code: '01' };
    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Invalid payment code' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('maps unexpected activation failures to a 500 response', async () => {
    activateVerifiedSubscriptionMock.mockRejectedValue(new Error('activation failed'));
    const data = { orderCode: 999, amount: 10_000, reference: 'ref-999', code: '00' };

    const response = await POST(
      webhookRequest({
        code: '00',
        desc: 'success',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Webhook processing failed' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'PayOS webhook error',
    );
  });
});
