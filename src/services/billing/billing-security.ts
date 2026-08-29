import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { BillingDomainError } from './billing-domain';
import { billingConfig } from './billing-config';

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

/**
 * The caller's address as the platform reports it.
 *
 * Three headers because three platforms: the reverse proxy's `x-real-ip`,
 * Cloudflare's own header, and the first hop of `x-forwarded-for` for anything
 * that only sets that. All of them are proxy-supplied and none is trustworthy
 * on its own — which is fine, because the only thing done with the result is
 * hashing it into a rate-limit bucket.
 */
function requestSourceAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    (forwarded ? forwarded : null)
  );
}

/**
 * A keyed hash of the caller's address, for the diagnostic row.
 *
 * Null when no secret is configured or no address was reported, rather than
 * falling back to an unkeyed digest: this one is written down and kept, and an
 * unkeyed hash of an IPv4 address is reversible by exhaustion.
 */
export function hashRequestSourceIp(request: NextRequest): string | null {
  const secret = billingConfig.abuseSignalSecret();
  const address = requestSourceAddress(request);
  if (!secret || !address) return null;
  return crypto.createHmac('sha256', secret).update(address).digest('hex');
}

/**
 * Only ever used to derive an ephemeral limiter bucket, never stored. Production
 * refuses to run without a real secret; a local run gets a fixed stand-in so the
 * limiter behaves the same way it will in production.
 */
const DEVELOPMENT_ABUSE_SECRET = 'rinkuzu-local-abuse-signal-secret-not-for-production-use';

/**
 * The bucket one unauthenticated webhook delivery is charged against.
 *
 * Never null, which is the point. The previous form returned the same null for
 * "no secret configured" and "no proxy header on this request", and the caller
 * read either as "skip the rate limit" — so a missing header, or a forgotten
 * environment variable, silently removed the only ceiling on how much
 * unauthenticated traffic one source could make the endpoint hash, classify and
 * write a row for. A delivery whose source the platform did not report still
 * costs that work, so it is charged against one shared bucket instead of being
 * waved through.
 */
export function webhookAbuseBucket(request: NextRequest): string {
  const secret = billingConfig.abuseSignalSecret();
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new BillingDomainError(
      'billing_configuration_error',
      'ABUSE_SIGNAL_HASH_SECRET is required to accept webhook traffic',
      500,
    );
  }
  return crypto
    .createHmac('sha256', secret ?? DEVELOPMENT_ABUSE_SECRET)
    .update(requestSourceAddress(request) ?? 'unattributed-source')
    .digest('hex');
}

export type ConsumeInternalNonce = (nonce: string, expiresAt: Date) => Promise<void>;

/**
 * A short, non-reversible id for one scheduler tick.
 *
 * The scheduler and the drain it triggers are logged by two different systems;
 * without a shared id the only way to tie a warning to the tick that produced
 * it is by timestamp, which stops working the moment two ticks overlap. The
 * nonce already identifies the tick uniquely, and hashing it means the log can
 * carry that identity without carrying a security token.
 */
export function internalTickId(request: NextRequest): string {
  const nonce = request.headers.get('x-rinkuzu-nonce') ?? '';
  return crypto.createHash('sha256').update(nonce).digest('hex').slice(0, 12);
}

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
