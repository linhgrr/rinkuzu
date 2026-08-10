import 'server-only';

import mongoose from 'mongoose';
import { RateLimiterMongo, RateLimiterRes } from 'rate-limiter-flexible';

import connectDB from '@/lib/mongoose';
import { apiErr } from '@/lib/api/response';

export type AuthRateLimitAction =
  | 'credentials_ip'
  | 'credentials_identity'
  | 'register_ip'
  | 'forgot_password_email'
  | 'resend_verification_email'
  | 'reset_password_token_ip'
  | 'verify_email_ip'
  | 'pdf_upload_intent_user';

type Limit = {
  points: number;
  durationSec: number;
};

const DEFAULTS: Record<AuthRateLimitAction, Limit> = {
  credentials_ip: { points: 20, durationSec: 60 * 15 },
  credentials_identity: { points: 10, durationSec: 60 * 15 },
  register_ip: { points: 5, durationSec: 60 * 60 }, // 5 / hour / IP
  forgot_password_email: { points: 3, durationSec: 60 * 60 }, // 3 / hour / email
  resend_verification_email: { points: 3, durationSec: 60 * 60 }, // 3 / hour / email
  reset_password_token_ip: { points: 10, durationSec: 60 * 15 }, // 10 / 15min / IP
  verify_email_ip: { points: 20, durationSec: 60 * 15 }, // 20 / 15min / IP
  pdf_upload_intent_user: { points: 20, durationSec: 60 * 15 }, // 20 upload URLs / 15min / user
};

const COLLECTION = 'auth_rate_limits';
const limiterCache = new Map<string, RateLimiterMongo>();

function envOverride(action: AuthRateLimitAction, key: 'points' | 'duration'): number | null {
  const envName = `AUTH_RATE_${action.toUpperCase()}_${key.toUpperCase()}`;
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
}

function resolveLimit(action: AuthRateLimitAction): Limit {
  return {
    points: envOverride(action, 'points') ?? DEFAULTS[action].points,
    durationSec: envOverride(action, 'duration') ?? DEFAULTS[action].durationSec,
  };
}

function getLimiter(action: AuthRateLimitAction): RateLimiterMongo {
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
    keyPrefix: `auth:${action}`,
    points: limit.points,
    duration: limit.durationSec,
    // Production indexes are an explicit deployment contract, not request-path DDL.
    disableIndexesCreation: process.env.NODE_ENV === 'production',
  });
  limiterCache.set(action, limiter);
  return limiter;
}

export type AuthRateLimitResult =
  | { allowed: true; remaining: number; resetSeconds: number; limit: number }
  | { allowed: false; retryAfterSeconds: number; limit: number };

export async function checkAuthRateLimit(
  action: AuthRateLimitAction,
  key: string,
): Promise<AuthRateLimitResult> {
  await connectDB();
  const limiter = getLimiter(action);
  const limit = resolveLimit(action);

  try {
    const result = await limiter.consume(key);
    return {
      allowed: true,
      remaining: Math.max(0, result.remainingPoints),
      resetSeconds: Math.ceil(result.msBeforeNext / 1000),
      limit: limit.points,
    };
  } catch (error) {
    // rate-limiter-flexible rejects with RateLimiterRes only when the quota is
    // exhausted. Operational failures (Mongo outage, timeout, auth error) must
    // remain failures instead of being mislabeled as a legitimate 429.
    if (!(error instanceof RateLimiterRes)) throw error;
    const ms = error.msBeforeNext;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(ms / 1000)),
      limit: limit.points,
    };
  }
}

export function rateLimitResponse(result: Extract<AuthRateLimitResult, { allowed: false }>) {
  return apiErr('rate_limit_exceeded', 'Too many requests. Try again later.', 429, {
    meta: { retryAfterSeconds: result.retryAfterSeconds, limit: result.limit },
  });
}
