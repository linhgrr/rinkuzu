import 'server-only';

import mongoose from 'mongoose';
import connectDB from '@/lib/mongoose';
import type { MeteredCapability, Tier } from '@/types/entitlements';

interface TelemetryFacetResult {
  totals: Array<{
    attempts: number;
    committed: number;
    refunded: number;
    denied: number;
    inFlight: number;
    stale: number;
  }>;
  uniqueUsers: Array<{ count: number }>;
  byCapability: Array<{
    _id: { capability: MeteredCapability; tier: Tier };
    attempts: number;
    committed: number;
    refunded: number;
    denied: number;
    stale: number;
    uniqueUsers: number;
  }>;
}

interface EntitlementTelemetryRow {
  capability: MeteredCapability;
  tier: Tier;
  attempts: number;
  committed: number;
  refunded: number;
  denied: number;
  stale: number;
  uniqueUsers: number;
}

export interface EntitlementTelemetry {
  windowDays: number;
  totals: {
    attempts: number;
    committed: number;
    refunded: number;
    denied: number;
    inFlight: number;
    stale: number;
    uniqueUsers: number;
  };
  byCapability: EntitlementTelemetryRow[];
}

export async function getEntitlementTelemetry(windowDays: number): Promise<EntitlementTelemetry> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is not initialized');
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const statusCounters = {
    attempts: { $sum: 1 },
    committed: { $sum: { $cond: [{ $eq: ['$effectiveStatus', 'committed'] }, 1, 0] } },
    refunded: { $sum: { $cond: [{ $eq: ['$effectiveStatus', 'refunded'] }, 1, 0] } },
    denied: { $sum: { $cond: [{ $eq: ['$effectiveStatus', 'denied'] }, 1, 0] } },
    stale: { $sum: { $cond: [{ $eq: ['$effectiveStatus', 'stale'] }, 1, 0] } },
  };
  const [result] = await db
    .collection('entitlement_usage_requests')
    .aggregate<TelemetryFacetResult>([
      { $match: { createdAt: { $gte: since } } },
      {
        $set: {
          effectiveStatus: {
            $cond: [
              {
                $and: [{ $eq: ['$status', 'reserved'] }, { $lte: ['$leaseExpiresAt', now] }],
              },
              'stale',
              '$status',
            ],
          },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                ...statusCounters,
                inFlight: { $sum: { $cond: [{ $eq: ['$effectiveStatus', 'reserved'] }, 1, 0] } },
              },
            },
          ],
          uniqueUsers: [{ $group: { _id: '$userId' } }, { $count: 'count' }],
          byCapability: [
            {
              $group: {
                _id: { capability: '$capability', tier: '$tier', userId: '$userId' },
                ...statusCounters,
              },
            },
            {
              $group: {
                _id: { capability: '$_id.capability', tier: '$_id.tier' },
                attempts: { $sum: '$attempts' },
                committed: { $sum: '$committed' },
                refunded: { $sum: '$refunded' },
                denied: { $sum: '$denied' },
                stale: { $sum: '$stale' },
                uniqueUsers: { $sum: 1 },
              },
            },
            { $sort: { attempts: -1, '_id.capability': 1, '_id.tier': 1 } },
          ],
        },
      },
    ])
    .toArray();

  const totals = result?.totals[0];
  return {
    windowDays,
    totals: {
      attempts: totals?.attempts ?? 0,
      committed: totals?.committed ?? 0,
      refunded: totals?.refunded ?? 0,
      denied: totals?.denied ?? 0,
      inFlight: totals?.inFlight ?? 0,
      stale: totals?.stale ?? 0,
      uniqueUsers: result?.uniqueUsers[0]?.count ?? 0,
    },
    byCapability:
      result?.byCapability.map((row) => ({
        capability: row._id.capability,
        tier: row._id.tier,
        attempts: row.attempts,
        committed: row.committed,
        refunded: row.refunded,
        denied: row.denied,
        stale: row.stale,
        uniqueUsers: row.uniqueUsers,
      })) ?? [],
  };
}
