import mongoose from 'mongoose';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { RateLimiterMongo } from 'rate-limiter-flexible';
import connectDB from '@/lib/mongoose';
import { apiErr } from '@/lib/api/response';
import type { UserRole } from '@/types/next-auth';

type LlmRateLimitAction =
  | 'quiz_ask_ai'
  | 'quiz_extract'
  | 'adaptive_pipeline'
  | 'adaptive_tutor_chat'
  | 'adaptive_generation';

type Tier = 'free' | 'premium';

type TierLimit = {
  minute: number;
  day: number;
};

type RateLimitConfig = Record<LlmRateLimitAction, Record<Tier, TierLimit>>;

type WindowResult = {
  window: 'minute' | 'day';
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

const DEFAULT_LIMITS: RateLimitConfig = {
  quiz_ask_ai: {
    free: { minute: 5, day: 20 },
    premium: { minute: 20, day: 200 },
  },
  quiz_extract: {
    free: { minute: 1, day: 3 },
    premium: { minute: 5, day: 30 },
  },
  adaptive_pipeline: {
    free: { minute: 1, day: 2 },
    premium: { minute: 3, day: 20 },
  },
  adaptive_tutor_chat: {
    free: { minute: 6, day: 30 },
    premium: { minute: 20, day: 300 },
  },
  adaptive_generation: {
    free: { minute: 6, day: 50 },
    premium: { minute: 20, day: 500 },
  },
};

const LIMITER_COLLECTION = 'llm_rate_limits';
const limiterCache = new Map<string, RateLimiterMongo>();

function readLimitEnv(action: LlmRateLimitAction, tier: Tier, window: 'minute' | 'day') {
  const key = `LLM_RATE_${action}_${tier}_${window}`.toUpperCase();
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}

function getLimit(action: LlmRateLimitAction, tier: Tier, window: 'minute' | 'day') {
  return readLimitEnv(action, tier, window) ?? DEFAULT_LIMITS[action][tier][window];
}

function retryAfterSeconds(resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}

function getWindowDurationSeconds(window: 'minute' | 'day') {
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

function getMongoLimiter(action: LlmRateLimitAction, tier: Tier, window: 'minute' | 'day') {
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
    points: getLimit(action, tier, window),
    duration: getWindowDurationSeconds(window),
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

async function incrementWindow(
  userId: string,
  action: LlmRateLimitAction,
  tier: Tier,
  window: 'minute' | 'day',
): Promise<WindowResult> {
  const limit = getLimit(action, tier, window);
  const limiter = getMongoLimiter(action, tier, window);

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

export function classifyAdaptiveLlmAction(
  targetPath: string,
  method: string,
): LlmRateLimitAction | null {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== 'POST') return null;

  if (targetPath === '/api/pipeline/process') return 'adaptive_pipeline';
  if (/^\/api\/session\/[^/]+\/chat$/.test(targetPath)) return 'adaptive_tutor_chat';

  if (
    targetPath === '/api/session/start' ||
    /^\/api\/session\/[^/]+\/(theory|exercise|submit|next-concept)$/.test(targetPath) ||
    /^\/api\/pipeline\/jobs\/[^/]+\/create-session$/.test(targetPath)
  ) {
    return 'adaptive_generation';
  }

  return null;
}

export async function checkLlmRateLimit(
  userId: string,
  action: LlmRateLimitAction,
): Promise<LlmRateLimitResult> {
  await connectDB();

  const subscriptionService = createSubscriptionService();
  const tier: Tier = (await subscriptionService.isUserPremium(userId)) ? 'premium' : 'free';

  const [minute, day] = await Promise.all([
    incrementWindow(userId, action, tier, 'minute'),
    incrementWindow(userId, action, tier, 'day'),
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
    tier,
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
