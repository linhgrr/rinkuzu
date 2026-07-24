import crypto from 'crypto';
import { z } from 'zod';
import { BillingDomainError } from './billing-domain';

const webhookDataSchema = z
  .object({
    orderCode: z.number().int().positive().safe(),
    amount: z.number().int().positive().safe(),
    reference: z.string().trim().min(1).max(200),
    currency: z.string().trim().min(1).max(10),
    paymentLinkId: z.string().trim().min(1).max(200),
    transactionDateTime: z.string().trim().min(1).max(100),
    code: z.string(),
    counterAccountBankId: z.string().nullish(),
    counterAccountNumber: z.string().nullish(),
  })
  .catchall(z.unknown());

const webhookSchema = z.strictObject({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

function sortRecordKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function signatureValue(value: unknown): string {
  if (value === null || value === undefined || value === 'null' || value === 'undefined') return '';
  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map((item) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? sortRecordKeys(item as Record<string, unknown>)
          : item,
      ),
    );
  }
  return String(value);
}

function signaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${signatureValue(data[key])}`)
    .join('&');
}

export interface VerifiedPayOSWebhook {
  rawPayloadHash: string;
  payload: z.infer<typeof webhookDataSchema>;
  ignored: boolean;
}

export function parseAndVerifyPayOSWebhook(rawBody: string): VerifiedPayOSWebhook {
  if (Buffer.byteLength(rawBody, 'utf8') > 64 * 1024) {
    throw new BillingDomainError('payload_too_large', 'Webhook payload exceeds 64 KB', 413);
  }
  const rawPayloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new BillingDomainError('invalid_webhook', 'Webhook body is not valid JSON', 400);
  }
  const envelope = webhookSchema.safeParse(json);
  if (!envelope.success) {
    throw new BillingDomainError('invalid_webhook', 'Webhook envelope is invalid', 400);
  }
  const checksumKey = process.env['PAYOS_CHECKSUM_KEY'];
  if (!checksumKey) {
    throw new BillingDomainError(
      'billing_configuration_error',
      'PayOS webhook is not configured',
      500,
    );
  }
  const expected = crypto
    .createHmac('sha256', checksumKey)
    .update(signaturePayload(envelope.data.data))
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(envelope.data.signature, 'hex');
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new BillingDomainError('invalid_webhook_signature', 'Webhook signature is invalid', 400);
  }
  if (
    envelope.data.success !== true ||
    envelope.data.code !== '00' ||
    envelope.data.data['code'] !== '00'
  ) {
    return {
      rawPayloadHash,
      payload: webhookDataSchema.parse({
        ...envelope.data.data,
        orderCode: Number(envelope.data.data['orderCode']),
        amount: Number(envelope.data.data['amount']),
      }),
      ignored: true,
    };
  }
  const payload = webhookDataSchema.safeParse({
    ...envelope.data.data,
    orderCode: Number(envelope.data.data['orderCode']),
    amount: Number(envelope.data.data['amount']),
  });
  if (!payload.success) {
    throw new BillingDomainError(
      'unsupported_webhook_schema',
      'Verified webhook schema is unsupported',
      422,
    );
  }
  return { rawPayloadHash, payload: payload.data, ignored: false };
}
