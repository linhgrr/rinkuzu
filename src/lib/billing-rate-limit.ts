import 'server-only';

import { createRateLimiterRegistry, type RateLimitWindow } from '@/lib/rate-limit-core';
import { BillingDomainError } from '@/services/billing/billing-domain';

/**
 * Billing endpoints are cheap to call and expensive to serve: quoting reads
 * plans, promotions and per-user counters, and verify/cancel each spend a
 * provider API call. Without a ceiling, one signed-in account can enumerate
 * promo codes or push the provider into rate-limiting the whole merchant.
 *
 * Separate from `auth-rate-limit` on purpose: different collection, different
 * lifecycle, different owners.
 */
export type BillingRateLimitAction =
  | 'quote_user'
  | 'order_create_user'
  | 'order_verify_user'
  | 'order_cancel_user'
  | 'order_attempt_user'
  /** Keyed by source address, and only ever charged for traffic we could not authenticate. */
  | 'webhook_unauthenticated';

const DEFAULTS: Record<BillingRateLimitAction, RateLimitWindow> = {
  // Generous enough for genuine promo retries, far below enumeration speed.
  quote_user: { points: 30, durationSec: 60 * 10 },
  order_create_user: { points: 10, durationSec: 60 * 10 },
  // Each of these reaches PayOS once per call.
  order_verify_user: { points: 20, durationSec: 60 * 10 },
  order_cancel_user: { points: 10, durationSec: 60 * 10 },
  order_attempt_user: { points: 5, durationSec: 60 * 10 },
  // Signature-valid deliveries are never charged, so this cannot throttle the
  // provider. It bounds how much unauthenticated traffic one source can make
  // the endpoint hash, classify and write a diagnostic row for.
  webhook_unauthenticated: { points: 20, durationSec: 60 * 5 },
};

const registry = createRateLimiterRegistry<BillingRateLimitAction>(
  { collection: 'billing_rate_limits', keyPrefix: 'billing:', envPrefix: 'BILLING_RATE' },
  DEFAULTS,
);

/**
 * Consumes one unit of the caller's budget, or throws a `BillingDomainError`
 * that `billingHttpError` renders as a 429 — the same shape every other
 * billing failure takes.
 */
export async function consumeBillingRateLimit(
  action: BillingRateLimitAction,
  key: string,
): Promise<void> {
  const result = await registry.consume(action, key);
  if (result.allowed) return;

  throw new BillingDomainError(
    'rate_limit_exceeded',
    `Too many billing requests. Try again in ${result.retryAfterSeconds}s.`,
    429,
  );
}
