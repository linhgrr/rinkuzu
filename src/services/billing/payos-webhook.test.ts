import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BillingDomainError } from './billing-domain';
import { parseAndVerifyPayOSWebhook } from './payos-webhook';

const checksumKey = 'test-checksum-key-with-at-least-32-characters';

function signedWebhook(data: Record<string, unknown>): string {
  const payload = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key] ?? ''}`)
    .join('&');
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data,
    signature: crypto.createHmac('sha256', checksumKey).update(payload).digest('hex'),
  });
}

describe('PayOS webhook verification', () => {
  beforeEach(() => {
    process.env['PAYOS_CHECKSUM_KEY'] = checksumKey;
  });

  afterEach(() => {
    delete process.env['PAYOS_CHECKSUM_KEY'];
  });

  it('verifies and normalizes a successful payment event', () => {
    const result = parseAndVerifyPayOSWebhook(
      signedWebhook({
        amount: 99_000,
        code: '00',
        currency: 'VND',
        orderCode: 123,
        paymentLinkId: 'payment-link',
        reference: 'transaction-reference',
        transactionDateTime: '2026-07-24T12:00:00Z',
      }),
    );

    expect(result.ignored).toBe(false);
    expect(result.payload.orderCode).toBe(123);
    expect(result.payload.amount).toBe(99_000);
  });

  it('distinguishes a verified unsupported schema from an invalid signature', () => {
    expect(() =>
      parseAndVerifyPayOSWebhook(
        signedWebhook({
          amount: 99_000,
          code: '00',
          currency: 'VND',
          orderCode: 123,
          paymentLinkId: 'payment-link',
          transactionDateTime: '2026-07-24T12:00:00Z',
        }),
      ),
    ).toThrowError(
      expect.objectContaining<BillingDomainError>({
        code: 'unsupported_webhook_schema',
      }),
    );

    const invalid = JSON.parse(
      signedWebhook({
        amount: 99_000,
        code: '00',
        currency: 'VND',
        orderCode: 123,
        paymentLinkId: 'payment-link',
        reference: 'transaction-reference',
        transactionDateTime: '2026-07-24T12:00:00Z',
      }),
    ) as { signature: string };
    invalid.signature = '0'.repeat(64);

    expect(() => parseAndVerifyPayOSWebhook(JSON.stringify(invalid))).toThrowError(
      expect.objectContaining<BillingDomainError>({
        code: 'invalid_webhook_signature',
      }),
    );
  });
});
