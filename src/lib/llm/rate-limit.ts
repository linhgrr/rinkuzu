import mongoose from 'mongoose';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import connectDB from '@/lib/mongoose';
import { apiErr } from '@/lib/api/response';
import type { UserRole } from '@/types/next-auth';
import {
  getLimit,
  resolveEntitlements,
  type Entitlements,
  type MeteredCapability,
  type RateWindow,
  type Tier,
} from '@/lib/entitlements';

// Re-export so route handlers can type their declared action without reaching
// into the entitlements module directly.
export type LlmRateLimitAction = MeteredCapability;

type WindowResult = {
  window: RateWindow;
  limit: number;
  remaining: number;
  resetAt: Date;
  count: number;
};

type LlmRateLimitResult = {
  allowed: boolean;
  tier: Tier;
  action: LlmRateLimitAction;
  minute: WindowResult;
  day: WindowResult;
  retryAfterSeconds?: number;
};

type RateLimiterResult = {
  consumedPoints: number;
  remainingPoints: number;
  msBeforeNext: number;
};

export function isAdminRole(role: unknown): role is UserRole {
  return role === 'admin';
}

const LIMITER_COLLECTION = 'llm_rate_limits';
const limiterCache = new Map<string, RateLimiterMongo>();

function retryAfterSeconds(resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}

function getWindowDurationSeconds(window: RateWindow) {
  return window === 'minute' ? 60 : 24 * 60 * 60;
}

function isRateLimiterResult(value: unknown): value is RateLimiterResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RateLimiterResult>;
  return (
    typeof candidate.consumedPoints === 'number' &&
    typeof candidate.remainingPoints === 'number' &&
    typeof candidate.msBeforeNext === 'number'
  );
}

function toWindowResult(
  window: 'minute' | 'day',
  limit: number,
  result: RateLimiterResult,
): WindowResult {
  return {
    window,
    limit,
    count: result.consumedPoints,
    remaining: Math.max(0, result.remainingPoints),
    resetAt: new Date(Date.now() + Math.max(0, result.msBeforeNext)),
  };
}

function getMongoLimiter(
  action: LlmRateLimitAction,
  tier: Tier,
  window: RateWindow,
  limit: number,
) {
  const cacheKey = `${action}:${tier}:${window}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB connection is not initialized');
  }

  const limiter = new RateLimiterMongo({
    storeClient: db,
    tableName: LIMITER_COLLECTION,
    keyPrefix: `llm:${cacheKey}`,
    points: limit,
    duration: getWindowDurationSeconds(window),
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

async function incrementWindow(
  userId: string,
  action: LlmRateLimitAction,
  entitlements: Entitlements,
  window: RateWindow,
): Promise<WindowResult> {
  const limit = getLimit(entitlements, action, window);
  const limiter = getMongoLimiter(action, entitlements.tier, window, limit);

  try {
    const result = await limiter.consume(userId);
    return toWindowResult(window, limit, result);
  } catch (error) {
    if (isRateLimiterResult(error)) {
      return toWindowResult(window, limit, error);
    }
    throw error;
  }
}

export async function checkLlmRateLimit(
  userId: string,
  action: LlmRateLimitAction,
): Promise<LlmRateLimitResult> {
  await connectDB();

  const entitlements = await resolveEntitlements(userId);

  const [minute, day] = await Promise.all([
    incrementWindow(userId, action, entitlements, 'minute'),
    incrementWindow(userId, action, entitlements, 'day'),
  ]);

  const exceeded = [minute, day].filter((item) => item.count > item.limit);
  const retryWindow =
    exceeded.length > 0
      ? exceeded.reduce((soonest, item) =>
          item.resetAt.getTime() < soonest.resetAt.getTime() ? item : soonest,
        )
      : null;

  return {
    allowed: exceeded.length === 0,
    tier: entitlements.tier,
    action,
    minute,
    day,
    retryAfterSeconds: retryWindow ? retryAfterSeconds(retryWindow.resetAt) : undefined,
  };
}

export function buildLlmRateLimitHeaders(result: LlmRateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    'X-RateLimit-Tier': result.tier,
    'X-RateLimit-Action': result.action,
    'X-RateLimit-Limit': String(result.day.limit),
    'X-RateLimit-Remaining': String(result.day.remaining),
    'X-RateLimit-Reset': result.day.resetAt.toISOString(),
  };

  if (result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }

  return headers;
}

export function buildLlmRateLimitResponse(result: LlmRateLimitResult) {
  const response = apiErr('llm_rate_limit_exceeded', 'LLM rate limit exceeded', 429, {
    action: result.action,
    tier: result.tier,
    retryAfterSeconds: result.retryAfterSeconds,
    limits: {
      minute: {
        limit: result.minute.limit,
        remaining: result.minute.remaining,
        resetAt: result.minute.resetAt.toISOString(),
      },
      day: {
        limit: result.day.limit,
        remaining: result.day.remaining,
        resetAt: result.day.resetAt.toISOString(),
      },
    },
  });

  Object.entries(buildLlmRateLimitHeaders(result)).forEach(([key, value]) => {
    if (value !== undefined) {
      response.headers.set(key, String(value));
    }
  });

  return response;
}
