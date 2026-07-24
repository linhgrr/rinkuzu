import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { BillingDomainError } from './billing-domain';

export function billingCsrfCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-rk_billing_csrf' : 'rk_billing_csrf';
}

export function assertBillingMutationRequest(request: NextRequest): void {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origin || origin !== requestUrl.origin) {
    throw new BillingDomainError('csrf_rejected', 'Cross-origin billing request rejected', 403);
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') {
    throw new BillingDomainError('csrf_rejected', 'Cross-site billing request rejected', 403);
  }
  const cookieToken = request.cookies.get(billingCsrfCookieName())?.value;
  const headerToken = request.headers.get('x-billing-csrf');
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    throw new BillingDomainError('csrf_rejected', 'Billing CSRF token is invalid', 403);
  }
}

export type ConsumeInternalNonce = (nonce: string, expiresAt: Date) => Promise<void>;

export async function assertInternalBillingRequest(
  request: NextRequest,
  consumeNonce: ConsumeInternalNonce,
): Promise<void> {
  const secret = process.env['BILLING_INTERNAL_HMAC_SECRET'];
  if (!secret || secret.length < 32) {
    throw new BillingDomainError(
      'billing_configuration_error',
      'Internal billing authentication is not configured',
      500,
    );
  }
  const timestamp = request.headers.get('x-rinkuzu-timestamp');
  const nonce = request.headers.get('x-rinkuzu-nonce');
  const signature = request.headers.get('x-rinkuzu-signature');
  if (!timestamp || !nonce || !signature || !/^\d{13}$/.test(timestamp)) {
    throw new BillingDomainError('unauthorized', 'Internal request is not authenticated', 401);
  }
  const timestampNumber = Number(timestamp);
  if (Math.abs(Date.now() - timestampNumber) > 5 * 60_000) {
    throw new BillingDomainError('unauthorized', 'Internal request timestamp expired', 401);
  }
  const url = new URL(request.url);
  const signed = `${request.method}\n${url.pathname}\n${timestamp}\n${nonce}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new BillingDomainError('unauthorized', 'Internal request signature is invalid', 401);
  }

  const allowedIps = (process.env['BILLING_INTERNAL_ALLOWED_IPS'] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const platformIp = request.headers.get('x-real-ip');
  if (allowedIps.length > 0 && (!platformIp || !allowedIps.includes(platformIp))) {
    throw new BillingDomainError('forbidden', 'Internal request source is not allowed', 403);
  }

  await consumeNonce(nonce, new Date(Date.now() + 10 * 60_000));
}
