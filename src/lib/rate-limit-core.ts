import 'server-only';

import mongoose from 'mongoose';
import { RateLimiterMongo, RateLimiterRes } from 'rate-limiter-flexible';

import connectDB from '@/lib/mongoose';

export interface RateLimitWindow {
  points: number;
  durationSec: number;
}

export interface RateLimiterRegistryOptions {
  collection: string;
  keyPrefix: string;
  envPrefix: string;
}

export type RateLimitOutcome =
  | { allowed: true; remaining: number; resetSeconds: number; limit: number }
  | { allowed: false; retryAfterSeconds: number; limit: number };

export interface RateLimiterRegistry<TAction extends string> {
  resolveLimit(action: TAction): RateLimitWindow;
  consume(action: TAction, key: string): Promise<RateLimitOutcome>;
  /** Gives one point back, e.g. when the work the point paid for never happened. */
  refund(action: TAction, key: string): Promise<void>;
}

/**
 * Shared Mongo-backed rate-limiter machinery for the auth and billing
 * modules. Each caller gets its own cache, collection, key prefix and
 * env-var namespace so the two domains stay fully isolated at runtime; only
 * the cache/env-override/consume mechanics are shared.
 */
export function createRateLimiterRegistry<TAction extends string>(
  options: RateLimiterRegistryOptions,
  defaults: Record<TAction, RateLimitWindow>,
): RateLimiterRegistry<TAction> {
  const { collection, keyPrefix, envPrefix } = options;
  const limiterCache = new Map<string, RateLimiterMongo>();

  function envOverride(action: TAction, key: 'points' | 'duration'): number | null {
    const envName = `${envPrefix}_${action.toUpperCase()}_${key.toUpperCase()}`;
    const raw = Number(process.env[envName]);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
  }

  function resolveLimit(action: TAction): RateLimitWindow {
    return {
      points: envOverride(action, 'points') ?? defaults[action].points,
      durationSec: envOverride(action, 'duration') ?? defaults[action].durationSec,
    };
  }

  function getLimiter(action: TAction): RateLimiterMongo {
    const cached = limiterCache.get(action);
    if (cached) return cached;

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not initialized');
    }

    const limit = resolveLimit(action);
    const limiter = new RateLimiterMongo({
      storeClient: db,
      tableName: collection,
      keyPrefix: `${keyPrefix}${action}`,
      points: limit.points,
      duration: limit.durationSec,
      // Production indexes are an explicit deployment contract, not request-path DDL.
      disableIndexesCreation: process.env.NODE_ENV === 'production',
    });
    limiterCache.set(action, limiter);
    return limiter;
  }

  async function consume(action: TAction, key: string): Promise<RateLimitOutcome> {
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

  async function refund(action: TAction, key: string): Promise<void> {
    await connectDB();
    await getLimiter(action).reward(key, 1);
  }

  return { resolveLimit, consume, refund };
}
