import { describe, expect, it } from 'vitest';
import { payosWebhookRequestSchema, verifySubscriptionRequestSchema } from '@/dtos/subscription';

describe('subscription DTO validation', () => {
  it('validates numeric and string order codes', () => {
    expect(verifySubscriptionRequestSchema.parse({ orderCode: 123 })).toEqual({
      orderCode: 123,
    });
    expect(verifySubscriptionRequestSchema.parse({ orderCode: '456' })).toEqual({
      orderCode: '456',
    });
  });

  it('rejects invalid order codes', () => {
    expect(() => verifySubscriptionRequestSchema.parse({ orderCode: 0 })).toThrow();
    expect(() => verifySubscriptionRequestSchema.parse({ orderCode: 'abc' })).toThrow();
  });

  it('validates PayOS webhook envelopes while preserving extra signed data keys', () => {
    expect(
      payosWebhookRequestSchema.parse({
        code: '00',
        success: true,
        signature: 'abc123',
        data: {
          orderCode: 123,
          amount: '99000',
          reference: 'txn-1',
          code: '00',
          extraSignedField: true,
        },
      }),
    ).toEqual({
      code: '00',
      success: true,
      signature: 'abc123',
      data: {
        orderCode: 123,
        amount: '99000',
        reference: 'txn-1',
        code: '00',
        extraSignedField: true,
      },
    });

    expect(
      payosWebhookRequestSchema.safeParse({
        success: true,
        signature: '',
        data: {},
      }).success,
    ).toBe(false);
  });
});
