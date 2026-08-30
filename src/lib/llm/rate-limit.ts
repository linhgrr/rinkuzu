import 'server-only';

import mongoose from 'mongoose';
import type { ClientSession, Collection } from 'mongodb';
import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { apiErr } from '@/lib/api/response';
import {
  getMeteredWindows,
  resolveEntitlements,
  type Entitlements,
  type MeteredCapability,
  type RateWindow,
  type Tier,
} from '@/lib/entitlements';

export type LlmRateLimitAction = MeteredCapability;

export interface WindowResult {
  window: RateWindow;
  limit: number;
  remaining: number;
  resetAt: Date;
  count: number;
}

export interface LlmUsageReservation {
  allowed: boolean;
  disposition: 'reserved' | 'committed' | 'denied';
  userId: string;
  tier: Tier;
  action: LlmRateLimitAction;
  requestId: string;
  duplicate: boolean;
  windows: WindowResult[];
  retryAfterSeconds?: number;
}

interface UsageBucket {
  userId: string;
  capability: LlmRateLimitAction;
  window: RateWindow;
  bucketStart: Date;
  expiresAt: Date;
  count: number;
  updatedAt: Date;
}

interface UsageRequest {
  userId: string;
  capability: LlmRateLimitAction;
  requestId: string;
  tier: Tier;
  status: 'reserved' | 'committed' | 'refunded' | 'denied';
  buckets: Array<{ window: RateWindow; bucketStart: Date }>;
  leaseExpiresAt: Date;
  retentionExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface UsageRequestInsertFields {
  userId: string;
  capability: LlmRateLimitAction;
  requestId: string;
  createdAt: Date;
  retentionExpiresAt: Date;
}

const BUCKET_COLLECTION = 'entitlement_usage_buckets';
const REQUEST_COLLECTION = 'entitlement_usage_requests';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const RESERVATION_LEASE_MS = 10 * 60 * 1000;
const RAW_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

function collections(): {
  buckets: Collection<UsageBucket>;
  requests: Collection<UsageRequest>;
} {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not initialized');
  return {
    buckets: db.collection<UsageBucket>(BUCKET_COLLECTION),
    requests: db.collection<UsageRequest>(REQUEST_COLLECTION),
  };
}

function windowBounds(window: RateWindow, now: Date): { start: Date; end: Date } {
  if (window === 'minute') {
    const startMs = Math.floor(now.getTime() / 60_000) * 60_000;
    return { start: new Date(startMs), end: new Date(startMs + 60_000) };
  }

  const local = new Date(now.getTime() + VN_OFFSET_MS);
  if (window === 'day') {
    const startMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    return {
      start: new Date(startMs - VN_OFFSET_MS),
      end: new Date(startMs + 86_400_000 - VN_OFFSET_MS),
    };
  }

  const startMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  const endMs = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1);
  return { start: new Date(startMs - VN_OFFSET_MS), end: new Date(endMs - VN_OFFSET_MS) };
}

async function readWindows(
  userId: string,
  action: LlmRateLimitAction,
  entitlements: Entitlements,
  now: Date,
  session?: ClientSession,
): Promise<WindowResult[]> {
  const { buckets } = collections();
  return Promise.all(
    getMeteredWindows(entitlements, action).map(async ({ window, limit }) => {
      const bounds = windowBounds(window, now);
      const bucket = await buckets.findOne(
        { userId, capability: action, window, bucketStart: bounds.start },
        { session },
      );
      const count = Math.max(0, bucket?.count ?? 0);
      return {
        window,
        limit,
        count,
        remaining: Math.max(0, limit - count),
        resetAt: bounds.end,
      };
    }),
  );
}

function retryAfterSeconds(windows: WindowResult[]): number | undefined {
  const exceeded = windows.filter((item) => item.count >= item.limit);
  if (exceeded.length === 0) return undefined;
  const resetAt = Math.max(...exceeded.map((item) => item.resetAt.getTime()));
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

function usageRequestInsertFields(
  userId: string,
  action: LlmRateLimitAction,
  requestId: string,
  now: Date,
): UsageRequestInsertFields {
  return {
    userId,
    capability: action,
    requestId,
    createdAt: now,
    retentionExpiresAt: new Date(now.getTime() + RAW_RETENTION_MS),
  };
}

async function recoverExpiredReservation(
  userId: string,
  action: LlmRateLimitAction,
  request: UsageRequest,
): Promise<void> {
  if (request.status !== 'reserved' || request.leaseExpiresAt > new Date()) return;
  await refundLlmUsage({
    allowed: true,
    disposition: 'reserved',
    userId,
    tier: 'free',
    action,
    requestId: request.requestId,
    duplicate: false,
    windows: [],
  });
}

export async function reserveLlmUsage(
  userId: string,
  action: LlmRateLimitAction,
  requestId: string,
): Promise<LlmUsageReservation> {
  await connectDB();
  const entitlements = await resolveEntitlements(userId);
  const now = new Date();
  const { buckets, requests } = collections();
  const existing = await requests.findOne({ userId, capability: action, requestId });
  if (existing) {
    await recoverExpiredReservation(userId, action, existing);
    const refreshed = await requests.findOne({ userId, capability: action, requestId });
    if (refreshed?.status !== 'refunded') {
      return {
        allowed: refreshed?.status === 'committed',
        disposition:
          refreshed?.status === 'committed'
            ? 'committed'
            : refreshed?.status === 'denied'
              ? 'denied'
              : 'reserved',
        userId,
        tier: entitlements.tier,
        action,
        requestId,
        duplicate: true,
        windows: await readWindows(userId, action, entitlements, now),
      };
    }
  }

  const client = mongoose.connection.getClient();
  const session = client.startSession();
  try {
    const reservation = await session.withTransaction(async () => {
      const concurrent = await requests.findOne(
        { userId, capability: action, requestId },
        { session },
      );
      if (concurrent && concurrent.status !== 'refunded') {
        return {
          allowed: concurrent.status === 'committed',
          disposition:
            concurrent.status === 'committed'
              ? 'committed'
              : concurrent.status === 'denied'
                ? 'denied'
                : 'reserved',
          userId,
          tier: entitlements.tier,
          action,
          requestId,
          duplicate: true,
          windows: await readWindows(userId, action, entitlements, now, session),
        } satisfies LlmUsageReservation;
      }

      const before = await readWindows(userId, action, entitlements, now, session);
      if (before.some((item) => item.count >= item.limit)) {
        await requests.updateOne(
          { userId, capability: action, requestId },
          {
            $set: {
              tier: entitlements.tier,
              status: 'denied',
              buckets: [],
              leaseExpiresAt: now,
              updatedAt: now,
            },
            $setOnInsert: usageRequestInsertFields(userId, action, requestId, now),
          },
          { upsert: true, session },
        );
        return {
          allowed: false,
          disposition: 'denied',
          userId,
          tier: entitlements.tier,
          action,
          requestId,
          duplicate: false,
          windows: before,
          retryAfterSeconds: retryAfterSeconds(before),
        } satisfies LlmUsageReservation;
      }

      for (const item of before) {
        const bounds = windowBounds(item.window, now);
        await buckets.updateOne(
          { userId, capability: action, window: item.window, bucketStart: bounds.start },
          {
            $inc: { count: 1 },
            $set: { expiresAt: bounds.end, updatedAt: now },
            $setOnInsert: {
              userId,
              capability: action,
              window: item.window,
              bucketStart: bounds.start,
            },
          },
          { upsert: true, session },
        );
      }

      const bucketRefs = before.map((item) => ({
        window: item.window,
        bucketStart: windowBounds(item.window, now).start,
      }));
      await requests.updateOne(
        { userId, capability: action, requestId },
        {
          $set: {
            tier: entitlements.tier,
            status: 'reserved',
            buckets: bucketRefs,
            leaseExpiresAt: new Date(now.getTime() + RESERVATION_LEASE_MS),
            updatedAt: now,
          },
          $setOnInsert: usageRequestInsertFields(userId, action, requestId, now),
        },
        { upsert: true, session },
      );
      return {
        allowed: true,
        disposition: 'reserved',
        userId,
        tier: entitlements.tier,
        action,
        requestId,
        duplicate: false,
        windows: before.map((item) => ({
          ...item,
          count: item.count + 1,
          remaining: Math.max(0, item.limit - item.count - 1),
        })),
      } satisfies LlmUsageReservation;
    });
    if (!reservation) throw new Error('Usage reservation transaction returned no result');
    return reservation;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return reserveLlmUsage(userId, action, requestId);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function commitLlmUsage(reservation: LlmUsageReservation): Promise<void> {
  if (!reservation.allowed) return;
  const { requests } = collections();
  await requests.updateOne(
    {
      userId: reservation.userId,
      requestId: reservation.requestId,
      capability: reservation.action,
      status: 'reserved',
    },
    { $set: { status: 'committed', updatedAt: new Date() } },
  );
}

export async function refundLlmUsage(reservation: LlmUsageReservation): Promise<void> {
  if (!reservation.allowed) return;
  await connectDB();
  const { buckets, requests } = collections();
  const client = mongoose.connection.getClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const request = await requests.findOne(
        {
          userId: reservation.userId,
          requestId: reservation.requestId,
          capability: reservation.action,
        },
        { session },
      );
      if (!request || request.status !== 'reserved') return;
      for (const bucket of request.buckets) {
        await buckets.updateOne(
          {
            userId: request.userId,
            capability: request.capability,
            window: bucket.window,
            bucketStart: bucket.bucketStart,
            count: { $gt: 0 },
          },
          { $inc: { count: -1 }, $set: { updatedAt: new Date() } },
          { session },
        );
      }
      await requests.updateOne(
        { _id: request._id, status: 'reserved' },
        { $set: { status: 'refunded', updatedAt: new Date() } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function getLlmUsageSnapshot(
  userId: string,
  action: LlmRateLimitAction,
  entitlements: Entitlements,
): Promise<WindowResult[]> {
  await connectDB();
  return readWindows(userId, action, entitlements, new Date());
}

export function buildLlmRateLimitHeaders(result: LlmUsageReservation): HeadersInit {
  const primary = [...result.windows].sort((a, b) => b.resetAt.getTime() - a.resetAt.getTime())[0];
  const headers: Record<string, string> = {
    'X-RateLimit-Tier': result.tier,
    'X-RateLimit-Action': result.action,
  };
  if (primary) {
    headers['X-RateLimit-Limit'] = String(primary.limit);
    headers['X-RateLimit-Remaining'] = String(primary.remaining);
    headers['X-RateLimit-Reset'] = primary.resetAt.toISOString();
  }
  if (result.retryAfterSeconds) headers['Retry-After'] = String(result.retryAfterSeconds);
  return headers;
}

export function buildLlmRateLimitResponse(result: LlmUsageReservation) {
  return apiErr('quota_exceeded', 'Usage quota exceeded', 429, {
    capability: result.action,
    tier: result.tier,
    upgradeEligible: result.tier === 'free',
    retryAfterSeconds: result.retryAfterSeconds,
    windows: Object.fromEntries(
      result.windows.map((item) => [
        item.window,
        {
          used: item.count,
          limit: item.limit,
          remaining: item.remaining,
          resetAt: item.resetAt.toISOString(),
        },
      ]),
    ),
  });
}
