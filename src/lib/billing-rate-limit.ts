import 'server-only';

import mongoose from 'mongoose';
import { RateLimiterMongo, RateLimiterRes } from 'rate-limiter-flexible';

import connectDB from '@/lib/mongoose';
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

type Limit = {
  points: number;
  durationSec: number;
};

const DEFAULTS: Record<BillingRateLimitAction, Limit> = {
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

const COLLECTION = 'billing_rate_limits';
const limiterCache = new Map<string, RateLimiterMongo>();

function envOverride(action: BillingRateLimitAction, key: 'points' | 'duration'): number | null {
  const envName = `BILLING_RATE_${action.toUpperCase()}_${key.toUpperCase()}`;
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
}

function resolveLimit(action: BillingRateLimitAction): Limit {
  return {
    points: envOverride(action, 'points') ?? DEFAULTS[action].points,
    durationSec: envOverride(action, 'duration') ?? DEFAULTS[action].durationSec,
  };
}

function getLimiter(action: BillingRateLimitAction): RateLimiterMongo {
  const cached = limiterCache.get(action);
  if (cached) return cached;

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not initialized');
  }

  const limit = resolveLimit(action);
  const limiter = new RateLimiterMongo({
    storeClient: db,
    tableName: COLLECTION,
    keyPrefix: `billing:${action}`,
    points: limit.points,
    duration: limit.durationSec,
    // Production indexes are an explicit deployment contract, not request-path DDL.
    disableIndexesCreation: process.env.NODE_ENV === 'production',
  });
  limiterCache.set(action, limiter);
  return limiter;
}

/**
 * Consumes one unit of the caller's budget, or throws a `BillingDomainError`
 * that `billingHttpError` renders as a 429 — the same shape every other
 * billing failure takes.
 */
export async function consumeBillingRateLimit(
  action: BillingRateLimitAction,
  key: string,
): Promise<void> {
  await connectDB();
  const limiter = getLimiter(action);

  try {
    await limiter.consume(key);
  } catch (error) {
    // rate-limiter-flexible rejects with RateLimiterRes only when the quota is
    // exhausted. Operational failures (Mongo outage, timeout) must stay
    // failures instead of being mislabeled as a legitimate 429.
    if (!(error instanceof RateLimiterRes)) throw error;
    const retryAfterSeconds = Math.max(1, Math.ceil(error.msBeforeNext / 1_000));
    throw new BillingDomainError(
      'rate_limit_exceeded',
      `Too many billing requests. Try again in ${retryAfterSeconds}s.`,
      429,
    );
  }
}
