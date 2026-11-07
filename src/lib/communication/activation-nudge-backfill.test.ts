import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { NudgeLearner, NudgeRow } from '@/repositories/ActivationNudgeRepository';

const policy = vi.hoisted(() => ({ decide: vi.fn() }));
vi.mock('./activation-nudge-policy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./activation-nudge-policy')>();
  policy.decide.mockImplementation(actual.decideActivationNudge);
  return { ...actual, decideActivationNudge: policy.decide };
});

import {
  runActivationNudgeBackfill,
  type ActivationNudgeBackfillMode,
} from './activation-nudge-backfill';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BACKFILL_SPACING_MS = 30_000;
const NOW = new Date('2026-11-07T12:00:00.000Z');

let seq = 0;
function learner(overrides: Partial<NudgeLearner> = {}): NudgeLearner {
  seq += 1;
  return {
    id: new Types.ObjectId(),
    email: `learner${seq}@mail.fixture-rinkuzu.vn`,
    name: 'Fixture Learner',
    role: 'user',
    disable: 0,
    isTestAccount: false,
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    locale: null,
    ...overrides,
  };
}

/** In-memory twin of the repository: rows keyed by dedupe key, like the unique index. */
function fakeSource(
  learners: NudgeLearner[],
  options: { signups?: number; attempted?: NudgeLearner[]; unsubscribed?: NudgeLearner[] } = {},
) {
  const rows = new Map<string, NudgeRow>();
  const ids = (list: NudgeLearner[] = []) => new Set(list.map((item) => item.id.toString()));
  return {
    rows,
    source: {
      countSignupsBetween: vi.fn(async () => options.signups ?? learners.length),
      learnersSignedUpBetween: vi.fn(async () => learners),
      blockers: vi.fn(async () => ({
        attempted: ids(options.attempted),
        unsubscribed: ids(options.unsubscribed),
        nudged: new Set([...rows.values()].map((row) => row.userId.toString())),
      })),
      enqueue: vi.fn(async (row: NudgeRow) => {
        if (rows.has(row.dedupeKey)) return false;
        rows.set(row.dedupeKey, row);
        return true;
      }),
    },
  };
}

function run(
  source: ReturnType<typeof fakeSource>['source'],
  mode: ActivationNudgeBackfillMode,
  adaptive: ReadonlySet<string> | null = new Set(),
) {
  return runActivationNudgeBackfill({
    mode,
    now: NOW,
    source,
    adaptiveCompleters: async () => adaptive,
    from: 'Rinkuzu <support@notify.fixture.vn>',
  });
}

describe('runActivationNudgeBackfill', () => {
  it('decides every candidate through the sweep eligibility and counts each exclusion', async () => {
    const eligible = learner();
    const attempted = learner();
    const adaptiveOnly = learner();
    const unsubscribed = learner();
    const fresh = learner({ createdAt: new Date(NOW.getTime() - 2 * HOUR) });
    const flagged = learner({ isTestAccount: true });
    const old = learner({ createdAt: new Date(NOW.getTime() - 60 * DAY) });
    const all = [eligible, attempted, adaptiveOnly, unsubscribed, fresh, flagged, old];
    const { source, rows } = fakeSource(all, {
      signups: all.length + 2,
      attempted: [attempted],
      unsubscribed: [unsubscribed],
    });
    policy.decide.mockClear();

    const report = await run(source, 'dry-run', new Set([adaptiveOnly.id.toString()]));

    expect(policy.decide).toHaveBeenCalledTimes(all.length);
    for (const call of policy.decide.mock.calls) expect(call[4]).toBe('backfill');
    expect(report).toMatchObject({
      mode: 'dry-run',
      lookbackDays: 90,
      signups: 9,
      eligible: 2,
      enqueued: 0,
      excluded: {
        activated: 2,
        excluded_account: 3,
        unsubscribed: 1,
        already_nudged: 0,
        too_early: 1,
      },
      adaptiveChecked: true,
    });
    expect(source.enqueue).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it('spaces n enqueued rows 30 s apart on the per-account dedupe key', async () => {
    const learners = [learner(), learner({ locale: 'en' }), learner()];
    const { source, rows } = fakeSource(learners);

    const report = await run(source, 'apply');

    const enqueued = [...rows.values()];
    expect(enqueued.map((row) => row.availableAt.getTime() - NOW.getTime())).toEqual([
      0,
      BACKFILL_SPACING_MS,
      2 * BACKFILL_SPACING_MS,
    ]);
    expect(enqueued.map((row) => row.dedupeKey)).toEqual(
      learners.map((item) => `activation_nudge:${item.id.toString()}`),
    );
    expect(enqueued.every((row) => row.trigger === 'backfill')).toBe(true);
    expect(enqueued.map((row) => row.locale)).toEqual(['vi', 'en', 'vi']);
    expect(report).toMatchObject({
      enqueued: 3,
      firstSendAt: NOW.toISOString(),
      lastSendAt: new Date(NOW.getTime() + 2 * BACKFILL_SPACING_MS).toISOString(),
    });
  });

  it('inserts once when applied twice', async () => {
    const { source, rows } = fakeSource([learner(), learner()]);

    const first = await run(source, 'apply');
    const second = await run(source, 'apply');

    expect(first.enqueued).toBe(2);
    expect(second).toMatchObject({ eligible: 0, enqueued: 0, excluded: { already_nudged: 2 } });
    expect(rows.size).toBe(2);
  });

  it('reports an unanswered adaptive check instead of failing', async () => {
    const { source } = fakeSource([learner()]);

    const report = await run(source, 'dry-run', null);

    expect(report).toMatchObject({ eligible: 1, adaptiveChecked: false });
  });
});
