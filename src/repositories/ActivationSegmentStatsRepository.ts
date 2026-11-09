import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';
import type {
  ActivationSegmentBy,
  ActivationSegmentWeekRecord,
  IActivationSegmentStatsRepository,
} from '@/interfaces/repositories/IActivationSegmentStatsRepository';
import connectDB from '@/lib/mongoose';
import UserModel from '@/models/User';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import {
  SEGMENT_FIELDS,
  toSegmentWeekRecord,
  type SegmentCohortAggregate,
} from '@/repositories/pipelines/activation-segments';

/**
 * Activation cohorts split by signup locale or country (RIN-1268). Runs the
 * same cohort pipeline as `AdminStatsRepository.getActivationAggregates`, so
 * the definitions cannot drift; only the group key gains the segment.
 */
export class ActivationSegmentStatsRepository implements IActivationSegmentStatsRepository {
  async getActivationSegments(
    from: Date,
    to: Date,
    by: ActivationSegmentBy,
    adaptive: readonly AdminAdaptiveLearnerEvents[] = [],
  ): Promise<ActivationSegmentWeekRecord[]> {
    await connectDB();
    const learners = await AdminStatsRepository.adaptiveLearnerRows(adaptive);
    const rows = await UserModel.aggregate<SegmentCohortAggregate>(
      AdminStatsRepository.cohortPipeline(from, to, learners, SEGMENT_FIELDS[by]),
    ).allowDiskUse(true);
    return rows.map(toSegmentWeekRecord);
  }
}
