import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { ActivationSegmentStatsRepository } from '@/repositories/ActivationSegmentStatsRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * `getActivationSegments` (RIN-1268) on a seeded fixture: the segments of a
 * week sum to the default cohort row, and each learner lands in the segment of
 * their own signup field. Timestamps are in March 2002, away from other suites.
 */
const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

const W10 = at('2002-03-04T00:00:00.000Z'); // Monday of 2002-W10
const W11 = at('2002-03-11T00:00:00.000Z');
const END = at('2002-03-18T00:00:00.000Z');

describe('activation segments integration', () => {
  const runId = `segments-${randomUUID()}`;
  const ids = Array.from({ length: 7 }, () => new Types.ObjectId());
  const quiz = new Types.ObjectId();
  const idAt = (index: number): Types.ObjectId => {
    const value = ids[index];
    if (!value) throw new Error(`no fixture id ${index}`);
    return value;
  };

  function user(index: number, createdAt: Date, extra: Record<string, unknown>) {
    return {
      _id: idAt(index),
      _integrationRun: runId,
      email: `${runId}-${index}@learners.fixture`,
      role: 'user',
      disable: 0,
      authVersion: 0,
      createdAt,
      ...extra,
    };
  }

  function attempt(index: number, takenAt: Date) {
    return { _integrationRun: runId, user: idAt(index), quiz, takenAt, score: 50 };
  }

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    const db = mongoose.connection;
    const day1 = plus(W10, DAY);
    await db.collection('users').insertMany([
      // W10: en/VN activated, en/US not, vi/VN activated, legacy (no fields) activated.
      user(0, day1, { signupLocale: 'en', signupCountry: 'VN' }),
      user(1, day1, { signupLocale: 'en', signupCountry: 'US' }),
      user(2, day1, { signupLocale: 'vi', signupCountry: 'VN' }),
      user(3, day1, {}),
      // W10: vi with a null country (no header), activated only by an adaptive completion.
      user(4, day1, { signupLocale: 'vi', signupCountry: null }),
      // W11: en/VN, attempt on day 7 exactly → not activated.
      user(5, plus(W11, DAY), { signupLocale: 'en', signupCountry: 'VN' }),
      // Excluded (admin): never counted in any segment.
      user(6, day1, { role: 'admin', signupLocale: 'en', signupCountry: 'VN' }),
    ]);
    await db
      .collection('attempts')
      .insertMany([
        attempt(0, plus(day1, DAY)),
        attempt(2, plus(day1, 2 * DAY)),
        attempt(3, plus(day1, 3 * DAY)),
        attempt(5, plus(plus(W11, DAY), 7 * DAY)),
        attempt(6, plus(day1, DAY)),
      ]);
  });

  afterAll(async () => {
    const db = mongoose.connection;
    await Promise.all([
      db.collection('users').deleteMany({ _integrationRun: runId }),
      db.collection('attempts').deleteMany({ _integrationRun: runId }),
    ]);
    await mongoose.disconnect();
  });

  const adaptive = () => [
    {
      userId: idAt(4).toHexString(),
      firstCompletionAt: plus(W10, 2 * DAY),
      completions: [plus(W10, 2 * DAY)],
      succeededUploads: [plus(W10, DAY)],
    },
  ];

  function byWeek(rows: { weekStart: Date; segment: string | null }[]) {
    return rows
      .map((row) => ({ ...row, weekStart: row.weekStart.toISOString() }))
      .sort((a, b) =>
        `${a.weekStart}|${a.segment ?? ''}`.localeCompare(`${b.weekStart}|${b.segment ?? ''}`),
      );
  }

  it('splits the cohort by signup locale, null for accounts without one', async () => {
    const rows = await new ActivationSegmentStatsRepository().getActivationSegments(
      W10,
      END,
      'locale',
      adaptive(),
    );
    expect(byWeek(rows)).toEqual([
      { weekStart: W10.toISOString(), segment: null, signups: 1, activated: 1 },
      { weekStart: W10.toISOString(), segment: 'en', signups: 2, activated: 1 },
      { weekStart: W10.toISOString(), segment: 'vi', signups: 2, activated: 2 },
      { weekStart: W11.toISOString(), segment: 'en', signups: 1, activated: 0 },
    ]);
  });

  it('splits the cohort by signup country and sums to the default cohort rows', async () => {
    const [rows, aggregates] = await Promise.all([
      new ActivationSegmentStatsRepository().getActivationSegments(W10, END, 'country', adaptive()),
      new AdminStatsRepository().getActivationAggregates(W10, END, adaptive()),
    ]);
    expect(byWeek(rows)).toEqual([
      { weekStart: W10.toISOString(), segment: null, signups: 2, activated: 2 },
      { weekStart: W10.toISOString(), segment: 'US', signups: 1, activated: 0 },
      { weekStart: W10.toISOString(), segment: 'VN', signups: 2, activated: 2 },
      { weekStart: W11.toISOString(), segment: 'VN', signups: 1, activated: 0 },
    ]);
    for (const cohort of aggregates.cohorts) {
      const week = rows.filter((row) => row.weekStart.getTime() === cohort.weekStart.getTime());
      expect(week.reduce((sum, row) => sum + row.signups, 0)).toBe(cohort.signups);
      expect(week.reduce((sum, row) => sum + row.activated, 0)).toBe(cohort.activated);
    }
  });
});
