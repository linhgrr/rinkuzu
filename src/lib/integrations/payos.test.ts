import { describe, expect, it } from 'vitest';
import { payosCreatePaymentResponseSchema, payosPaymentLinkResponseSchema } from './payos';

describe('PayOS response contracts', () => {
  it('accepts the documented create-payment response', () => {
    expect(
      payosCreatePaymentResponseSchema.safeParse({
        code: '00',
        desc: 'success',
        data: {
          bin: '970422',
          accountNumber: '113366668888',
          accountName: 'MERCHANT',
          amount: 10_000,
          description: 'ORDER 123',
          orderCode: 123,
          currency: 'VND',
          paymentLinkId: 'payment-link-id',
          status: 'PENDING',
          checkoutUrl: 'https://pay.payos.vn/web/payment-link-id',
          qrCode: 'qr-code',
        },
        signature: 'signature',
      }).success,
    ).toBe(true);
  });

  it('accepts the documented payment-link response and transaction list', () => {
    expect(
      payosPaymentLinkResponseSchema.safeParse({
        code: '00',
        desc: 'success',
        data: {
          id: 'payment-link-id',
          orderCode: 123,
          amount: 10_000,
          amountPaid: 10_000,
          amountRemaining: 0,
          status: 'PAID',
          createdAt: '2026-07-02T04:00:00.000Z',
          transactions: [
            {
              reference: 'transaction-reference',
              amount: 10_000,
              accountNumber: '113366668888',
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
        },
        signature: 'signature',
      }).success,
    ).toBe(true);
  });

  it('rejects the stale single-transaction verification shape', () => {
    const result = payosPaymentLinkResponseSchema.safeParse({
      code: '00',
      desc: 'success',
      data: {
        orderCode: '123',
        amount: 10_000,
        reference: 'legacy-reference',
        status: 'PAID',
      },
    });

    expect(result.success).toBe(false);
  });
});
