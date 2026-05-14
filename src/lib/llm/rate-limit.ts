import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import { ServiceFactory } from '@/lib/serviceFactory';
import LlmUsage from '@/models/LlmUsage';
import type { AdaptiveUserRole } from '@/lib/adaptive-learning/config';

export type LlmRateLimitAction =
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

export type LlmRateLimitResult = {
  allowed: boolean;
  tier: Tier;
  action: LlmRateLimitAction;
  minute: WindowResult;
  day: WindowResult;
  retryAfterSeconds?: number;
};

export function isAdminRole(role: unknown): role is AdaptiveUserRole {
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

function readLimitEnv(action: LlmRateLimitAction, tier: Tier, window: 'minute' | 'day') {
  const key = `LLM_RATE_${action}_${tier}_${window}`.toUpperCase();
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}

function getLimit(action: LlmRateLimitAction, tier: Tier, window: 'minute' | 'day') {
  return readLimitEnv(action, tier, window) ?? DEFAULT_LIMITS[action][tier][window];
}

function getWindowDates(window: 'minute' | 'day', now = new Date()) {
  const start = new Date(now);
  if (window === 'minute') {
    start.setSeconds(0, 0);
    return {
      start,
      resetAt: new Date(start.getTime() + 60_000),
      expireAt: new Date(start.getTime() + 2 * 60_000),
    };
  }

  start.setHours(0, 0, 0, 0);
  return {
    start,
    resetAt: new Date(start.getTime() + 24 * 60 * 60_000),
    expireAt: new Date(start.getTime() + 3 * 24 * 60 * 60_000),
  };
}

function retryAfterSeconds(resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}

async function incrementWindow(
  userId: string,
  action: LlmRateLimitAction,
  tier: Tier,
  window: 'minute' | 'day',
): Promise<WindowResult> {
  const limit = getLimit(action, tier, window);
  const { start, resetAt, expireAt } = getWindowDates(window);

  const usage = (await LlmUsage.findOneAndUpdate(
    { userId, action, window, windowStart: start },
    {
      $setOnInsert: { userId, action, window, windowStart: start },
      $set: { tier, expireAt },
      $inc: { count: 1 },
    },
    { upsert: true, new: true, lean: true },
  )) as { count?: number } | null;

  const count = Number(usage?.count || 0);
  return {
    window,
    limit,
    count,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
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

  const subscriptionService = ServiceFactory.createSubscriptionService();
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
  return NextResponse.json(
    {
      detail: 'LLM rate limit exceeded',
      code: 'llm_rate_limit_exceeded',
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
    },
    { status: 429, headers: buildLlmRateLimitHeaders(result) },
  );
}
