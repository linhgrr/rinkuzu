import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordPaymentEventMock, recordDiagnosticMock, consumeRateLimitMock } = vi.hoisted(() => ({
  recordPaymentEventMock: vi.fn(),
  recordDiagnosticMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/billing-factory', () => ({
  createWebhookInboxRepository: () => ({
    recordPaymentEvent: recordPaymentEventMock,
    recordDiagnostic: recordDiagnosticMock,
  }),
}));
vi.mock('@/lib/billing-rate-limit', () => ({
  consumeBillingRateLimit: consumeRateLimitMock,
}));

import { POST } from '@/app/api/billing/webhooks/[provider]/route';
import { BillingDomainError } from '@/services/billing/billing-domain';

const CHECKSUM_KEY = 'test-checksum-key-with-at-least-32-characters';
const ABUSE_SECRET = 'an-abuse-signal-secret-of-at-least-32-chars';

function signedBody(data: Record<string, unknown>): string {
  const payload = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => `${key}=${data[key] ?? ''}`)
    .join('&');
  return JSON.stringify({
    code: '00',
    desc: 'success',
    success: true,
    data,
    signature: crypto.createHmac('sha256', CHECKSUM_KEY).update(payload).digest('hex'),
  });
}

const PAYMENT = signedBody({
  amount: 99_000,
  code: '00',
  currency: 'VND',
  orderCode: 4242,
  paymentLinkId: 'payment-link',
  reference: 'transaction-reference',
  transactionDateTime: '2026-08-28T09:00:00Z',
});

function webhookRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://rinkuzu.test/api/billing/webhooks/payos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

const PARAMS = { params: Promise.resolve({ provider: 'payos' }) };

/**
 * The endpoint is open to the internet, and the only thing separating a real
 * payment notice from a forgery is the checksum. That shapes both halves of
 * what is tested here: every request the endpoint *reads* has to leave a row
 * behind, and the two it refuses before reading have to cost an anonymous
 * caller a limiter token rather than a database write.
 */
describe('POST /api/billing/webhooks/[provider]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PAYOS_CHECKSUM_KEY', CHECKSUM_KEY);
    vi.stubEnv('ABUSE_SIGNAL_HASH_SECRET', ABUSE_SECRET);
    recordPaymentEventMock.mockResolvedValue({ duplicate: false, inboxId: 'inbox-1' });
    recordDiagnosticMock.mockResolvedValue({ duplicate: false, inboxId: 'inbox-2' });
    consumeRateLimitMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('records a verified payment and spends no unauthenticated budget on it', async () => {
    const response = await POST(webhookRequest(PAYMENT, { 'x-real-ip': '203.0.113.5' }), PARAMS);

    expect(response.status).toBe(200);
    expect(recordPaymentEventMock).toHaveBeenCalledTimes(1);
    // The budget exists for traffic we could not authenticate. Charging the
    // provider's own retries against it would throttle real money.
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
  });

  it('keys the stored source hash rather than storing the address', async () => {
    await POST(webhookRequest(PAYMENT, { 'x-real-ip': '203.0.113.5' }), PARAMS);

    const facts = recordPaymentEventMock.mock.calls[0]?.[0]?.facts;
    expect(facts.sourceIpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(facts)).not.toContain('203.0.113.5');
  });

  it('refuses a declared oversized body before it reads a single byte', async () => {
    const response = await POST(
      webhookRequest(PAYMENT, { 'content-length': String(70 * 1024) }),
      PARAMS,
    );

    expect(response.status).toBe(413);
    // Neither a row nor a limiter token: nothing was read, so there is nothing
    // to write down, and the caller never reached the buffer.
    expect(recordDiagnosticMock).not.toHaveBeenCalled();
    expect(recordPaymentEventMock).not.toHaveBeenCalled();
  });

  it('charges an unauthenticated delivery before it writes the diagnostic row', async () => {
    // Order is the whole point. Writing first and charging second means a flood
    // is bounded by how fast the database can absorb rows, not by the limiter.
    const order: string[] = [];
    consumeRateLimitMock.mockImplementation(async () => {
      order.push('rate-limit');
    });
    recordDiagnosticMock.mockImplementation(async () => {
      order.push('diagnostic');
      return { duplicate: false, inboxId: 'inbox-2' };
    });
    const tampered = JSON.parse(PAYMENT) as { signature: string };
    tampered.signature = '0'.repeat(64);

    const response = await POST(webhookRequest(JSON.stringify(tampered)), PARAMS);

    expect(response.status).toBe(400);
    expect(order).toEqual(['rate-limit', 'diagnostic']);
    expect(recordDiagnosticMock.mock.calls[0]?.[0]).toMatchObject({
      verificationClass: 'unauthenticated',
      rejectionReason: 'invalid_signature',
      rawBody: null,
    });
  });

  it('refuses a payment signed with a key that is not ours', async () => {
    // A well-formed HMAC is not proof on its own: it has to be the HMAC our
    // checksum key produces over this exact `data` object.
    const forged = JSON.parse(PAYMENT) as { data: Record<string, unknown>; signature: string };
    const payload = Object.keys(forged.data)
      .sort()
      .map((key) => `${key}=${String(forged.data[key])}`)
      .join('&');
    forged.signature = crypto
      .createHmac('sha256', 'an-attacker-key-of-at-least-32-characters')
      .update(payload)
      .digest('hex');

    const response = await POST(webhookRequest(JSON.stringify(forged)), PARAMS);

    expect(response.status).toBe(400);
    expect(recordPaymentEventMock).not.toHaveBeenCalled();
    expect(recordDiagnosticMock.mock.calls[0]?.[0]).toMatchObject({
      verificationClass: 'unauthenticated',
      rejectionReason: 'invalid_signature',
    });
  });

  it('refuses a payment that carries no signature at all', async () => {
    const { signature: _omitted, ...unsigned } = JSON.parse(PAYMENT) as Record<string, unknown>;

    const response = await POST(webhookRequest(JSON.stringify(unsigned)), PARAMS);

    expect(response.status).toBe(400);
    expect(recordPaymentEventMock).not.toHaveBeenCalled();
    expect(recordDiagnosticMock.mock.calls[0]?.[0]).toMatchObject({
      verificationClass: 'unauthenticated',
      rejectionReason: 'invalid_envelope',
    });
  });

  it('writes nothing at all once a source has spent its budget', async () => {
    consumeRateLimitMock.mockRejectedValue(
      new BillingDomainError('rate_limit_exceeded', 'Too many billing requests', 429),
    );

    const response = await POST(webhookRequest('{not json}'), PARAMS);

    expect(response.status).toBe(429);
    expect(recordDiagnosticMock).not.toHaveBeenCalled();
  });

  it('still charges a delivery the platform could not attribute', async () => {
    // No proxy header at all. The rate limit used to vanish entirely here, so
    // stripping one header bought unlimited unauthenticated writes.
    const response = await POST(webhookRequest('{not json}'), PARAMS);

    expect(response.status).toBe(400);
    expect(consumeRateLimitMock).toHaveBeenCalledTimes(1);
    expect(consumeRateLimitMock.mock.calls[0]?.[1]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('retains the body of a signed payload it cannot parse, and only that one', async () => {
    const unreadable = signedBody({ orderCode: 4242, code: '00', amount: 99_000 });

    const response = await POST(webhookRequest(unreadable), PARAMS);

    expect(response.status).toBe(200);
    expect(recordDiagnosticMock.mock.calls[0]?.[0]).toMatchObject({
      verificationClass: 'unsupported_schema',
    });
    expect(recordDiagnosticMock.mock.calls[0]?.[0].rawBody).toBe(unreadable);
    // A verified schema failure is our bug, not the caller's abuse.
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
  });

  it('records an authenticated non-payment notice and keeps the order it names', async () => {
    const response = await POST(
      webhookRequest(signedBody({ code: '01', desc: 'cancelled', orderCode: 4242 })),
      PARAMS,
    );

    expect(response.status).toBe(200);
    expect(recordDiagnosticMock.mock.calls[0]?.[0]).toMatchObject({
      verificationClass: 'ignored',
      orderCode: 4242,
      rawBody: null,
    });
  });

  it('answers a missing checksum key with a 500 rather than blaming the caller', async () => {
    vi.stubEnv('PAYOS_CHECKSUM_KEY', '');

    const response = await POST(webhookRequest(PAYMENT), PARAMS);

    // A 400 here would make the provider give up retrying on a fault we can fix.
    expect(response.status).toBe(500);
    expect(recordDiagnosticMock).toHaveBeenCalledTimes(1);
  });

  it('does not answer for a provider it does not serve', async () => {
    const response = await POST(webhookRequest(PAYMENT), {
      params: Promise.resolve({ provider: 'stripe' }),
    });

    expect(response.status).toBe(404);
    expect(recordPaymentEventMock).not.toHaveBeenCalled();
  });
});
