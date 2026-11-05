import type { PipelineStage } from 'mongoose';

/**
 * Stage builders shared by the activation pipelines of `AdminStatsRepository`
 * (cohorts and first attempts): the UTC week bucket, the activation-path sums,
 * and in-memory adaptive rows injected with `$documents`.
 */

/** The Monday (UTC) that starts the week of `date`. */
export function utcWeekStart(date: string): Record<string, unknown> {
  return { $dateTrunc: { date, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } };
}

/** `quiz only`, `adaptive only` and `both` sums over two boolean fields. */
export function pathCountAccumulators(quiz: string, adaptive: string): Record<string, unknown> {
  const count = (condition: unknown) => ({ $sum: { $cond: [condition, 1, 0] } });
  return {
    byQuiz: count({ $and: [quiz, { $not: [adaptive] }] }),
    byAdaptive: count({ $and: [adaptive, { $not: [quiz] }] }),
    byBoth: count({ $and: [quiz, adaptive] }),
  };
}

/**
 * In-memory rows injected with `$unionWith: { pipeline: [{ $documents }] }`
 * (MongoDB 6.0+). The adaptive events live in the API database, which a
 * cross-database `$unionWith` cannot reach; they are a handful of rows.
 * Nothing is injected for an empty list.
 */
export function unionDocuments(documents: readonly Record<string, unknown>[]): PipelineStage[] {
  if (documents.length === 0) return [];
  const stage: PipelineStage.UnionWith = {
    $unionWith: { pipeline: [{ $documents: [...documents] }] },
  } as PipelineStage.UnionWith;
  return [stage];
}
