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
    .sort()
    .map((field) => `${field}=${data[field] ?? ''}`)
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
        success: true,
        data: { orderCode: 1, amount: 1000 },
        signature: 'deadbeef',
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'configuration_error' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid request bodies before signature checks', async () => {
    const response = await POST(webhookRequest({ signature: '' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
  });

  it('rejects invalid signatures with timing-safe comparison', async () => {
    const data = { orderCode: 123, amount: 99_000, reference: 'ref-1' };
    const response = await POST(
      webhookRequest({
        code: '00',
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

  it('ignores non-successful payment notifications after signature validation', async () => {
    const data = { orderCode: 123, amount: 99_000 };
    const response = await POST(
      webhookRequest({
        code: '01',
        success: false,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      meta: { message: 'Webhook ignored' },
    });
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe or missing order codes and amounts', async () => {
    const invalidOrder = { orderCode: 0, amount: 1000 };
    const missingAmount = { orderCode: 42 };
    const invalidOrderResponse = await POST(
      webhookRequest({
        code: '00',
        success: true,
        data: invalidOrder,
        signature: sign(invalidOrder),
      }),
    );
    const missingAmountResponse = await POST(
      webhookRequest({
        code: '00',
        success: true,
        data: missingAmount,
        signature: sign(missingAmount),
      }),
    );

    expect(invalidOrderResponse.status).toBe(400);
    expect(missingAmountResponse.status).toBe(400);
    expect(activateVerifiedSubscriptionMock).not.toHaveBeenCalled();
  });

  it('activates verified subscriptions with optional reference and code fields', async () => {
    const data = {
      orderCode: 456,
      amount: 120_000,
      reference: 'payos-ref',
      code: '00',
    };
    const response = await POST(
      webhookRequest({
        code: '00',
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
      code: '00',
    });
  });

  it('activates without optional fields when they are omitted', async () => {
    const data = { orderCode: 789, amount: 50_000 };
    const response = await POST(
      webhookRequest({
        code: '00',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(200);
    expect(activateVerifiedSubscriptionMock).toHaveBeenCalledWith(789, {
      orderCode: 789,
      amount: 50_000,
    });
  });

  it('maps unexpected activation failures to a 500 response', async () => {
    activateVerifiedSubscriptionMock.mockRejectedValue(new Error('activation failed'));
    const data = { orderCode: 999, amount: 10_000 };

    const response = await POST(
      webhookRequest({
        code: '00',
        success: true,
        data,
        signature: sign(data),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error' },
    });
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
