import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WEBHOOK_REJECTION_REASONS } from './domain/webhook-diagnostics';
import {
  classifyPayOSWebhook,
  webhookRejectionErrorCode,
  webhookRejectionStatus,
  webhookVerificationClass,
} from './payos-webhook';

const checksumKey = 'test-checksum-key-with-at-least-32-characters';
const otherKey = 'a-different-checksum-key-with-32-characters';

/**
 * Canonicalizes exactly the way the verifier does, including dropping absent
 * keys rather than signing them as empty. A helper that signed a key the
 * receiver never sees would make every schema test fail as a bad signature,
 * and would hide the one thing these tests exist to separate.
 */
function signedWebhook(data: Record<string, unknown>, key = checksumKey): string {
  const payload = Object.keys(data)
    .filter((entry) => data[entry] !== undefined)
    .sort()
    .map((entry) => `${entry}=${data[entry] ?? ''}`)
    .join('&');
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data,
    signature: crypto.createHmac('sha256', key).update(payload).digest('hex'),
  });
}

const successfulPayment = {
  amount: 99_000,
  code: '00',
  currency: 'VND',
  orderCode: 123,
  paymentLinkId: 'payment-link',
  reference: 'transaction-reference',
  transactionDateTime: '2026-07-24T12:00:00Z',
};

/**
 * Classification is the whole security boundary of the webhook endpoint, and
 * every branch of it now has to produce a durable outcome rather than an
 * exception the route may or may not catch. These tests pin each branch and,
 * just as importantly, pin that an unreadable body is still distinguished from
 * an unauthenticated one — collapsing the two is what lets a rotated key look
 * like a schema bug.
 */
describe('PayOS webhook classification', () => {
  beforeEach(() => {
    process.env['PAYOS_CHECKSUM_KEY'] = checksumKey;
  });

  afterEach(() => {
    delete process.env['PAYOS_CHECKSUM_KEY'];
    delete process.env['PAYOS_CHECKSUM_KEYS'];
  });

  it('accepts and normalizes a successful payment event', () => {
    const outcome = classifyPayOSWebhook(signedWebhook(successfulPayment));

    expect(outcome.kind).toBe('accepted');
    if (outcome.kind !== 'accepted') throw new Error('Expected an accepted webhook');
    expect(outcome.payload.orderCode).toBe(123);
    expect(outcome.payload.amount).toBe(99_000);
    expect(outcome.rawPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(webhookVerificationClass(outcome)).toBe('accepted');
  });

  it('ignores an authenticated non-success event and keeps the order it names', () => {
    // A cancellation notice carries none of the fields a payment carries. It is
    // not discarded: the order code makes it a reconciliation trigger, because
    // the provider's API and not the notice decides what actually happened.
    const outcome = classifyPayOSWebhook(
      signedWebhook({ code: '01', desc: 'cancelled', orderCode: 123 }),
    );

    expect(outcome.kind).toBe('ignored');
    if (outcome.kind !== 'ignored') throw new Error('Expected an ignored webhook');
    expect(outcome.orderCode).toBe(123);
    expect(outcome.eventCode).toBe('00');
    expect(webhookVerificationClass(outcome)).toBe('ignored');
  });

  it('reports no order code when an ignored notice names none', () => {
    const outcome = classifyPayOSWebhook(signedWebhook({ code: '01', desc: 'cancelled' }));

    expect(outcome.kind).toBe('ignored');
    if (outcome.kind !== 'ignored') throw new Error('Expected an ignored webhook');
    expect(outcome.orderCode).toBeNull();
  });

  it('separates a verified but unreadable payload from a bad signature', () => {
    const unreadable = classifyPayOSWebhook(
      signedWebhook({ ...successfulPayment, reference: undefined }),
    );
    expect(unreadable.kind).toBe('unsupported_schema');
    if (unreadable.kind !== 'unsupported_schema') throw new Error('Expected unsupported schema');
    // The body is carried out so it can be retained, under encryption, as the
    // only evidence of what the parser could not read.
    expect(unreadable.rawBody).toContain('payment-link');

    const tampered = JSON.parse(signedWebhook(successfulPayment)) as { signature: string };
    tampered.signature = '0'.repeat(64);
    const rejected = classifyPayOSWebhook(JSON.stringify(tampered));

    expect(rejected.kind).toBe('rejected');
    if (rejected.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    expect(rejected.reason).toBe('invalid_signature');
    expect(webhookVerificationClass(rejected)).toBe('unauthenticated');
  });

  it('verifies against the one checksum key and nothing else', () => {
    // PayOS issues a single checksum key per merchant and accepts no overlap
    // window, so there is no key list here to fall back to. A payload signed
    // with anything else is unauthenticated, which is what makes a one-sided
    // key change visible in the diagnostics instead of silently accepted.
    expect(classifyPayOSWebhook(signedWebhook(successfulPayment, checksumKey)).kind).toBe(
      'accepted',
    );

    const other = classifyPayOSWebhook(signedWebhook(successfulPayment, otherKey));
    expect(other.kind).toBe('rejected');
    if (other.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    expect(other.reason).toBe('invalid_signature');
    expect(webhookVerificationClass(other)).toBe('unauthenticated');
  });

  it('ignores a stale rotation list rather than honouring a retired key', () => {
    // The variable is refused outright by `npm run check:billing`, but a
    // deployment that still carries it must not quietly widen what verifies.
    process.env['PAYOS_CHECKSUM_KEYS'] = JSON.stringify([
      { kid: 'retired', secret: otherKey },
      { kid: 'current', secret: checksumKey },
    ]);

    expect(classifyPayOSWebhook(signedWebhook(successfulPayment, otherKey)).kind).toBe('rejected');
    expect(classifyPayOSWebhook(signedWebhook(successfulPayment, checksumKey)).kind).toBe(
      'accepted',
    );
  });

  it('refuses to verify anything when no checksum key is configured', () => {
    delete process.env['PAYOS_CHECKSUM_KEY'];
    const outcome = classifyPayOSWebhook(signedWebhook(successfulPayment));

    expect(outcome.kind).toBe('rejected');
    if (outcome.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    // A misconfiguration on our side is a 500, never a 400 blamed on the caller.
    expect(outcome.reason).toBe('provider_not_configured');
    expect(webhookRejectionStatus(outcome.reason)).toBe(500);
    expect(webhookRejectionErrorCode(outcome.reason)).toBe('configuration_error');
  });

  it('rejects malformed JSON and an unrecognizable envelope separately', () => {
    const malformed = classifyPayOSWebhook('{not json');
    expect(malformed.kind).toBe('rejected');
    if (malformed.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    expect(malformed.reason).toBe('malformed_json');

    const envelope = classifyPayOSWebhook(JSON.stringify({ hello: 'world' }));
    expect(envelope.kind).toBe('rejected');
    if (envelope.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    expect(envelope.reason).toBe('invalid_envelope');
    expect(webhookRejectionStatus(envelope.reason)).toBe(400);
  });

  it('rejects an oversized body before parsing it', () => {
    const outcome = classifyPayOSWebhook(JSON.stringify({ padding: 'x'.repeat(70 * 1024) }));

    expect(outcome.kind).toBe('rejected');
    if (outcome.kind !== 'rejected') throw new Error('Expected a rejected webhook');
    expect(outcome.reason).toBe('payload_too_large');
    expect(webhookRejectionStatus(outcome.reason)).toBe(413);
    expect(outcome.byteSize).toBeGreaterThan(64 * 1024);
  });
});

/**
 * The endpoint is unauthenticated, so its rejection body is the only thing an
 * integrator — or the provider's own delivery dashboard — sees. A code that is
 * not in the shared contract is a code nothing on the other side can switch on,
 * and two of these were exactly that before they were remapped.
 */
describe('rejection codes are ones the API contract carries', () => {
  it('maps every rejection reason to a registered error code', () => {
    const contract = JSON.parse(
      readFileSync(join(process.cwd(), 'contracts/api-error-codes.json'), 'utf8'),
    ) as { defaultMessagesByCode: Record<string, string> };
    const registered = new Set(Object.keys(contract.defaultMessagesByCode));

    for (const reason of WEBHOOK_REJECTION_REASONS) {
      expect(registered.has(webhookRejectionErrorCode(reason))).toBe(true);
      // And every reason still earns its own HTTP status, so remapping the code
      // has not collapsed the four classes into one answer.
      expect(webhookRejectionStatus(reason)).toBeGreaterThanOrEqual(400);
    }
  });

  it('blames the caller for a bad request and ourselves for a missing key', () => {
    expect(webhookRejectionStatus('invalid_signature')).toBe(400);
    // A missing checksum key is our misconfiguration; a 400 would make the
    // provider give up retrying on a fault we can fix.
    expect(webhookRejectionStatus('provider_not_configured')).toBe(500);
  });
});
