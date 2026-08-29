import crypto from 'crypto';
import { z } from 'zod';
import { billingConfig } from './billing-config';
import type {
  WebhookRejectionReason,
  WebhookVerificationClass,
} from './domain/webhook-diagnostics';

/**
 * Turns one raw request body into a verdict.
 *
 * Nothing here throws. A webhook endpoint that throws its rejections away is an
 * endpoint nobody can debug: the provider sees a 400 and we see nothing, so a
 * signature that stopped matching after a key rotation is indistinguishable
 * from a scanner posting junk. Every path therefore produces a value the caller
 * can persist, and the caller decides the HTTP status from it.
 *
 * The envelope is deliberately tolerant of fields we do not know: providers add
 * them, and rejecting an otherwise valid, correctly signed message because it
 * grew a field is a self-inflicted outage. Tolerance stops at the fields that
 * matter — the signature is still required, still computed over exactly the
 * `data` object, and still compared in constant time.
 */

/**
 * The largest body this endpoint will read. A real PayOS notification is under
 * two kilobytes; the ceiling exists so an anonymous caller cannot make the
 * process buffer an arbitrary amount of text before anything has been checked.
 */
export const MAX_WEBHOOK_BYTES = 64 * 1024;

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

type PayOSPaymentEvent = z.infer<typeof webhookDataSchema>;

const webhookEnvelopeSchema = z
  .object({
    code: z.string(),
    desc: z.string(),
    success: z.boolean(),
    data: z.record(z.string(), z.unknown()),
    signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
  })
  .catchall(z.unknown());

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

function signaturePayload(event: Record<string, unknown>): string {
  return Object.keys(event)
    .filter((key) => event[key] !== undefined)
    .sort()
    .map((key) => `${key}=${signatureValue(event[key])}`)
    .join('&');
}

function matchesChecksumKey(payload: string, received: string, secret: string): boolean {
  const receivedBuffer = Buffer.from(received, 'hex');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  return (
    expected.length === receivedBuffer.length && crypto.timingSafeEqual(expected, receivedBuffer)
  );
}

interface PayOSWebhookFacts {
  readonly rawPayloadHash: string;
  readonly byteSize: number;
}

export interface AcceptedPayOSWebhook extends PayOSWebhookFacts {
  readonly kind: 'accepted';
  readonly payload: PayOSPaymentEvent;
}

/**
 * Authenticated, understood, and not a successful payment: a cancellation, a
 * failure, or a notice type we take no direct action on. It is not discarded —
 * when it names an order, it becomes a reconciliation trigger, because the
 * provider's own API, not the notice, is the authority on what happened.
 */
interface IgnoredPayOSWebhook extends PayOSWebhookFacts {
  readonly kind: 'ignored';
  readonly eventCode: string;
  readonly eventDesc: string;
  readonly orderCode: number | null;
}

interface UnsupportedPayOSWebhook extends PayOSWebhookFacts {
  readonly kind: 'unsupported_schema';
  readonly rawBody: string;
}

interface RejectedPayOSWebhook extends PayOSWebhookFacts {
  readonly kind: 'rejected';
  readonly reason: WebhookRejectionReason;
}

export type PayOSWebhookOutcome =
  | AcceptedPayOSWebhook
  | IgnoredPayOSWebhook
  | UnsupportedPayOSWebhook
  | RejectedPayOSWebhook;

export function webhookVerificationClass(outcome: PayOSWebhookOutcome): WebhookVerificationClass {
  switch (outcome.kind) {
    case 'accepted':
      return 'accepted';
    case 'ignored':
      return 'ignored';
    case 'unsupported_schema':
      return 'unsupported_schema';
    case 'rejected':
      return 'unauthenticated';
  }
}

const REJECTION_STATUS: Record<WebhookRejectionReason, number> = {
  payload_too_large: 413,
  malformed_json: 400,
  invalid_envelope: 400,
  invalid_signature: 400,
  provider_not_configured: 500,
};

export function webhookRejectionStatus(reason: WebhookRejectionReason): number {
  return REJECTION_STATUS[reason];
}

/**
 * Every reason maps to a code the shared API error contract already carries.
 * The precise reason is not lost — it is the detail on the response and the
 * `rejectionReason` on the inbox row — but the code an integrator switches on
 * has to be one both sides of the contract agree exists, and `invalid_webhook`
 * and `payload_too_large` were never in it.
 */
const REJECTION_ERROR_CODE: Record<WebhookRejectionReason, string> = {
  payload_too_large: 'validation_error',
  malformed_json: 'validation_error',
  invalid_envelope: 'validation_error',
  invalid_signature: 'invalid_webhook_signature',
  provider_not_configured: 'configuration_error',
};

export function webhookRejectionErrorCode(reason: WebhookRejectionReason): string {
  return REJECTION_ERROR_CODE[reason];
}

function facts(rawBody: string): PayOSWebhookFacts {
  return {
    rawPayloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
    byteSize: Buffer.byteLength(rawBody, 'utf8'),
  };
}

function optionalOrderCode(event: Record<string, unknown>): number | null {
  const parsed = Number(event['orderCode']);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function classifyPayOSWebhook(rawBody: string): PayOSWebhookOutcome {
  const base = facts(rawBody);
  if (base.byteSize > MAX_WEBHOOK_BYTES) {
    return { ...base, kind: 'rejected', reason: 'payload_too_large' };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ...base, kind: 'rejected', reason: 'malformed_json' };
  }

  const envelope = webhookEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    return { ...base, kind: 'rejected', reason: 'invalid_envelope' };
  }
  const checksumKey = billingConfig.payosChecksumKey();
  if (checksumKey === null) {
    return { ...base, kind: 'rejected', reason: 'provider_not_configured' };
  }
  const event = envelope.data.data;
  if (!matchesChecksumKey(signaturePayload(event), envelope.data.signature, checksumKey)) {
    return { ...base, kind: 'rejected', reason: 'invalid_signature' };
  }

  const successful =
    envelope.data.success === true && envelope.data.code === '00' && event['code'] === '00';
  if (!successful) {
    return {
      ...base,
      kind: 'ignored',
      eventCode: String(envelope.data.code),
      eventDesc: envelope.data.desc.slice(0, 200),
      orderCode: optionalOrderCode(event),
    };
  }

  const payload = webhookDataSchema.safeParse({
    ...event,
    orderCode: Number(event['orderCode']),
    amount: Number(event['amount']),
  });
  if (!payload.success) {
    return { ...base, kind: 'unsupported_schema', rawBody };
  }
  return { ...base, kind: 'accepted', payload: payload.data };
}
