import { z } from 'zod';

const payosStatusSchema = z.enum(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED']);

const payosTransactionSchema = z.object({
  reference: z.string().min(1),
  amount: z.number().nonnegative(),
  accountNumber: z.string(),
  description: z.string(),
  transactionDateTime: z.string(),
  virtualAccountName: z.string().nullable(),
  virtualAccountNumber: z.string().nullable(),
  counterAccountBankId: z.string().nullable(),
  counterAccountBankName: z.string().nullable(),
  counterAccountName: z.string().nullable(),
  counterAccountNumber: z.string().nullable(),
});

const payosEnvelopeFields = {
  code: z.string(),
  desc: z.string(),
  signature: z.string().optional(),
};

export const payosErrorEnvelopeSchema = z.object(payosEnvelopeFields);

export const payosCreatePaymentResponseSchema = z.object({
  ...payosEnvelopeFields,
  data: z
    .object({
      bin: z.string(),
      accountNumber: z.string(),
      accountName: z.string(),
      amount: z.number().nonnegative(),
      description: z.string(),
      orderCode: z.number().int(),
      currency: z.string(),
      paymentLinkId: z.string(),
      status: payosStatusSchema,
      checkoutUrl: z.url(),
      qrCode: z.string(),
    })
    .nullish(),
});

export const payosPaymentLinkResponseSchema = z.object({
  ...payosEnvelopeFields,
  data: z
    .object({
      id: z.string(),
      orderCode: z.number().int(),
      amount: z.number().nonnegative(),
      amountPaid: z.number().nonnegative(),
      amountRemaining: z.number().nonnegative(),
      status: payosStatusSchema,
      createdAt: z.iso.datetime(),
      transactions: z.array(payosTransactionSchema),
      cancellationReason: z.string().nullable(),
      canceledAt: z.iso.datetime().nullable(),
    })
    .nullish(),
});
