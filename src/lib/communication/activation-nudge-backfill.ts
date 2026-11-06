import type {
  NudgeBlockers,
  NudgeLearner,
  NudgeRow,
} from '@/repositories/ActivationNudgeRepository';
import {
  activationNudgeDedupeKey,
  activationNudgeLocale,
  decideActivationNudge,
} from './activation-nudge-policy';

/**
 * The one-time activation-nudge backfill (RIN-1002): accounts created in the
 * last 90 days that the 24 h sweep never covered, decided by the same
 * eligibility rules as the sweep. A dry run only counts; an apply enqueues one
 * `activation_nudge` row per eligible learner on the sweep's dedupe key, 30 s
 * apart, so the worker sends at most one every 30 s. The report holds counts
 * only, never an address, name or id.
 */

const DAY_MS = 86_400_000;
const BACKFILL_LOOKBACK_DAYS = 90;
const BACKFILL_SPACING_MS = 30_000;
/** Far above the expected volume; reaching it fails the run rather than truncating it. */
const BACKFILL_LIMIT = 5_000;

export type ActivationNudgeBackfillMode = 'dry-run' | 'apply';

/** The reasons an account in the window is not emailed. */
const EXCLUSION_REASONS = [
  'activated',
  'excluded_account',
  'unsubscribed',
  'already_nudged',
  'too_early',
] as const;
type BackfillExclusion = (typeof EXCLUSION_REASONS)[number];

function isBackfillExclusion(reason: string): reason is BackfillExclusion {
  return (EXCLUSION_REASONS as readonly string[]).includes(reason);
}

export interface ActivationNudgeBackfillReport {
  mode: ActivationNudgeBackfillMode;
  lookbackDays: number;
  signups: number;
  eligible: number;
  enqueued: number;
  excluded: Record<BackfillExclusion, number>;
  /** False when the adaptive API did not answer: `eligible` is then an upper bound. */
  adaptiveChecked: boolean;
  firstSendAt: string | null;
  lastSendAt: string | null;
}

interface ActivationNudgeBackfillSource {
  countSignupsBetween(after: Date, until: Date): Promise<number>;
  learnersSignedUpBetween(after: Date, until: Date, limit: number): Promise<NudgeLearner[]>;
  blockers(userIds: readonly NudgeLearner['id'][]): Promise<NudgeBlockers>;
  enqueue(row: NudgeRow): Promise<boolean>;
}

export interface ActivationNudgeBackfillInput {
  mode: ActivationNudgeBackfillMode;
  now: Date;
  source: ActivationNudgeBackfillSource;
  /** Ids with an adaptive completion in `[from, to)`; `null` when the API cannot answer. */
  adaptiveCompleters: (from: Date, to: Date) => Promise<ReadonlySet<string> | null>;
  from: string;
}

export async function runActivationNudgeBackfill(
  input: ActivationNudgeBackfillInput,
): Promise<ActivationNudgeBackfillReport> {
  const { mode, now, source } = input;
  const after = new Date(now.getTime() - BACKFILL_LOOKBACK_DAYS * DAY_MS);
  const [signups, learners] = await Promise.all([
    source.countSignupsBetween(after, now),
    source.learnersSignedUpBetween(after, now, BACKFILL_LIMIT),
  ]);
  if (learners.length >= BACKFILL_LIMIT) {
    throw new Error(`activation-nudge backfill: more than ${BACKFILL_LIMIT} candidates`);
  }
  const excluded: Record<BackfillExclusion, number> = {
    activated: 0,
    excluded_account: signups - learners.length,
    unsubscribed: 0,
    already_nudged: 0,
    too_early: 0,
  };
  const blockers = await source.blockers(learners.map((learner) => learner.id));
  const adaptive =
    learners.length > 0 ? await input.adaptiveCompleters(after, now) : new Set<string>();

  const eligible: NudgeLearner[] = [];
  for (const learner of learners) {
    const verdict = decideActivationNudge(
      learner,
      blockers,
      adaptive ?? new Set<string>(),
      now,
      'backfill',
    );
    if (verdict.decision === 'send') eligible.push(learner);
    else if (isBackfillExclusion(verdict.reason)) excluded[verdict.reason] += 1;
  }

  const sendAt = (index: number) => new Date(now.getTime() + index * BACKFILL_SPACING_MS);
  let enqueued = 0;
  if (mode === 'apply') {
    for (const [index, learner] of eligible.entries()) {
      const inserted = await source.enqueue({
        dedupeKey: activationNudgeDedupeKey(learner.id.toString()),
        userId: learner.id,
        to: learner.email,
        from: input.from,
        locale: activationNudgeLocale(learner.locale),
        trigger: 'backfill',
        availableAt: sendAt(index),
      });
      if (inserted) enqueued += 1;
    }
  }
  return {
    mode,
    lookbackDays: BACKFILL_LOOKBACK_DAYS,
    signups,
    eligible: eligible.length,
    enqueued,
    excluded,
    adaptiveChecked: adaptive !== null,
    firstSendAt: eligible.length > 0 ? sendAt(0).toISOString() : null,
    lastSendAt: eligible.length > 0 ? sendAt(eligible.length - 1).toISOString() : null,
  };
}
