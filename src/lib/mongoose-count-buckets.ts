import type { PipelineStage } from 'mongoose';
import type { CountBuckets, CountBucketThresholds } from '@/interfaces/repositories/types';

export interface CountBucketAggregateRecord {
  _id: null;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface CountSinceAccumulator {
  $sum: {
    $cond: [unknown, number, number];
  };
}

function countSince(fieldName: string, threshold: Date): CountSinceAccumulator {
  return {
    $sum: {
      $cond: [{ $gte: [`$${fieldName}`, threshold] }, 1, 0],
    },
  };
}

export function buildCountBucketsPipeline(
  fieldName: string,
  thresholds: CountBucketThresholds,
): PipelineStage[] {
  return [
    {
      $match: {
        [fieldName]: { $gte: thresholds.thisMonth },
      },
    },
    {
      $group: {
        _id: null,
        today: countSince(fieldName, thresholds.today),
        thisWeek: countSince(fieldName, thresholds.thisWeek),
        thisMonth: { $sum: 1 },
      },
    },
  ];
}

export function resolveCountBuckets(records: CountBucketAggregateRecord[]): CountBuckets {
  const [record] = records;
  return {
    today: record?.today ?? 0,
    thisWeek: record?.thisWeek ?? 0,
    thisMonth: record?.thisMonth ?? 0,
  };
}
