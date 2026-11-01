import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { ActivationStatsService } from '@/services/admin/ActivationStatsService';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * Ground-truth activation counts on a seeded fixture.
 *
 * Every timestamp is in January 2001 (ISO 2001-W01 starts Monday 2001-01-01),
 * far from anything another suite writes, so the counts below are exact even
 * on a shared integration database.
 */
const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

const W01 = at('2001-01-01T00:00:00.000Z');
const W02 = at('2001-01-08T00:00:00.000Z');
const W03 = at('2001-01-15T00:00:00.000Z');
const W04 = at('2001-01-22T00:00:00.000Z');

describe('activation stats integration', () => {
  const runId = `activation-${randomUUID()}`;
  const id = () => new Types.ObjectId();
  const ids = {
    a: id(),
    b: id(),
    c: id(),
    d: id(),
    e: id(),
    f: id(),
    g: id(),
    admin: id(),
    disabled: id(),
    qa: id(),
  };
  const sharedQuiz = id();
  const signup = {
    a: at('2001-01-01T10:00:00.000Z'),
    b: at('2001-01-07T20:00:00.000Z'), // last day of W01
    c: at('2001-01-02T00:00:00.000Z'),
    d: at('2001-01-03T00:00:00.000Z'),
    e: at('2001-01-09T00:00:00.000Z'),
    f: at('2000-12-20T00:00:00.000Z'), // before the window
    g: at('2001-01-15T00:00:00.000Z'),
    admin: at('2001-01-02T00:00:00.000Z'),
    disabled: at('2001-01-10T00:00:00.000Z'),
    qa: at('2001-01-03T00:00:00.000Z'),
  };

  function user(key: keyof typeof ids, extra: Record<string, unknown> = {}) {
    return {
      _id: ids[key],
      _integrationRun: runId,
      email: `${runId}-${key}@learners.fixture`,
      role: 'user',
      disable: 0,
      authVersion: 0,
      createdAt: signup[key],
      updatedAt: signup[key],
      ...extra,
    };
  }

  // `slug` is unique on quizzes; the run id keeps it unique on a shared database.
  function quiz(key: string) {
    return { _integrationRun: runId, slug: `${runId}-${key}` };
  }

  function attempt(key: keyof typeof ids, takenAt: Date, quiz = sharedQuiz) {
    return { _integrationRun: runId, user: ids[key], quiz, takenAt, score: 50 };
  }

  beforeAll(async () => {
    try {
      await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
      const db = mongoose.connection;
      const ownQuizA = id();
      await db.collection('users').insertMany([
        user('a'),
        user('b'),
        user('c'),
        user('d'),
        user('e'),
        user('f'),
        user('g'),
        user('admin', { role: 'admin' }),
        user('disabled', { disable: 1 }),
        user('qa', { email: `${runId}-qa@example.test` }),
      ]);
      await db.collection('quizzes').insertMany([
        { ...quiz('shared'), _id: sharedQuiz, author: ids.admin, createdAt: signup.admin },
        { ...quiz('own-a'), _id: ownQuizA, author: ids.a, createdAt: plus(signup.a, DAY) },
        // D authors within 7 days and never attempts: material, not activated.
        { ...quiz('d'), author: ids.d, createdAt: plus(signup.d, 2 * DAY) },
        // C authors on day 7 exactly: outside the material window.
        { ...quiz('c'), author: ids.c, createdAt: plus(signup.c, 7 * DAY) },
      ]);
      await db.collection('attempts').insertMany([
        // A: own quiz on day 1, back on day 8 → activated and retained.
        attempt('a', plus(signup.a, DAY + 3_600_000), ownQuizA),
        attempt('a', plus(signup.a, 8 * DAY)),
        // B: signs up Sunday of W01, first attempt Monday of W02 (cross-week),
        // returns 1 ms before day 14 → activated W01, retained, first attempt W02.
        attempt('b', at('2001-01-08T01:00:00.000Z')),
        attempt('b', plus(signup.b, 14 * DAY - 1)),
        // C: first attempt exactly 7 days after signup → not activated; first attempt W02.
        attempt('c', plus(signup.c, 7 * DAY)),
        // E: activated, returns exactly on day 14 → not retained (window is days 7–13).
        attempt('e', plus(signup.e, DAY)),
        attempt('e', plus(signup.e, 14 * DAY)),
        // F: first attempt before the window; a later one never counts as first.
        attempt('f', plus(signup.f, DAY)),
        attempt('f', at('2001-01-10T00:00:00.000Z')),
        // G: activated on signup day in W03.
        attempt('g', plus(signup.g, 3_600_000)),
        // Excluded accounts are invisible everywhere.
        attempt('admin', at('2001-01-02T12:00:00.000Z')),
        attempt('disabled', at('2001-01-10T12:00:00.000Z')),
        attempt('qa', at('2001-01-03T12:00:00.000Z')),
        // Guests are not learners.
        {
          _integrationRun: runId,
          guestEmail: `${runId}-guest@learners.fixture`,
          quiz: sharedQuiz,
          takenAt: at('2001-01-04T00:00:00.000Z'),
          score: 10,
        },
      ]);
    } catch (error) {
      throw new Error('Activation stats integration setup failed; this suite needs MongoDB', {
        cause: error,
      });
    }
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection;
    await Promise.all([
      db.collection('users').deleteMany({ _integrationRun: runId }),
      db.collection('quizzes').deleteMany({ _integrationRun: runId }),
      db.collection('attempts').deleteMany({ _integrationRun: runId }),
      db.collection('adminactionaudits').deleteMany({ actorId: ids.admin }),
    ]);
    await mongoose.disconnect();
  }, 10_000);

  it('produces exact cohort and first-attempt counts per ISO week', async () => {
    const aggregates = await new AdminStatsRepository().getActivationAggregates(W01, W04);

    expect(aggregates.cohorts).toEqual([
      { weekStart: W01, signups: 4, material: 3, activated: 2, w1Retained: 2 },
      { weekStart: W02, signups: 1, material: 1, activated: 1, w1Retained: 0 },
      { weekStart: W03, signups: 1, material: 1, activated: 1, w1Retained: 0 },
    ]);
    expect(aggregates.firstAttempts).toEqual([
      { weekStart: W01, learners: 1 },
      { weekStart: W02, learners: 3 },
      { weekStart: W03, learners: 1 },
    ]);
  });

  it('serves the response contract with the 14-day completeness boundary and an audit entry', async () => {
    const service = new ActivationStatsService({
      stats: new AdminStatsRepository(),
      audit: new AdminAuditRepository(),
      // Monday of W05: exactly 14 days after W02 ended.
      now: () => at('2001-01-29T00:00:00.000Z'),
    });
    const result = await service.getWeeklyActivation(5, {
      kind: 'admin',
      userId: ids.admin.toHexString(),
      email: `${runId}-admin@learners.fixture`,
    });
    if (!result.success) throw new Error(result.error);

    expect(
      result.data.weeks.map(({ isoWeek, w1Retained, w1RetentionRate, complete }) => ({
        isoWeek,
        w1Retained,
        w1RetentionRate,
        complete,
      })),
    ).toEqual([
      { isoWeek: '2001-W01', w1Retained: 2, w1RetentionRate: 1, complete: true },
      { isoWeek: '2001-W02', w1Retained: 0, w1RetentionRate: 0, complete: true },
      { isoWeek: '2001-W03', w1Retained: null, w1RetentionRate: null, complete: false },
      { isoWeek: '2001-W04', w1Retained: null, w1RetentionRate: null, complete: false },
      { isoWeek: '2001-W05', w1Retained: null, w1RetentionRate: null, complete: false },
    ]);
    expect(result.data.weeks.map((week) => week.weeklyActivatedLearners)).toEqual([1, 3, 1, 0, 0]);
    expect(JSON.stringify(result.data)).not.toContain(runId);

    const audits = await mongoose.connection
      .collection('adminactionaudits')
      .find({ actorId: ids.admin })
      .toArray();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'stats.activation.read',
      entityType: 'stats',
      entityId: 'activation',
      details: { weeks: '5' },
    });
  });
});
