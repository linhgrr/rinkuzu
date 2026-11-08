import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';

import type { AdminAdaptiveLearnerEvents } from '@/interfaces/repositories/IAdminStatsRepository';
import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminStatsRepository } from '@/repositories/AdminStatsRepository';
import { ActivationEmailStatsRepository } from '@/repositories/ActivationEmailStatsRepository';
import { ActivationStatsService } from '@/services/admin/ActivationStatsService';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * Ground-truth activation counts on a seeded fixture.
 *
 * Every timestamp is in January 2001 (ISO 2001-W01 starts Monday 2001-01-01),
 * far from anything another suite writes, so the counts below are exact even
 * on a shared integration database.
 */
// A company-owned account on a real-looking domain: excluded only because its
// address is on `ANALYTICS_EXCLUDED_EMAILS`, which is stubbed here so the
// fixture never uses a real address.
const owned = vi.hoisted(() => ({
  email: `activation-owned-${globalThis.crypto.randomUUID()}@company-owned.fixture`,
}));
vi.mock('@/shared/constants/analytics-exclusions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/constants/analytics-exclusions')>();
  return {
    ...actual,
    ANALYTICS_EXCLUDED_EMAILS: [...actual.ANALYTICS_EXCLUDED_EMAILS, owned.email],
  };
});

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
    h: id(),
    i: id(),
    j: id(),
    k: id(),
    l: id(),
    admin: id(),
    disabled: id(),
    qa: id(),
    owned: id(),
    flagged: id(),
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
    h: at('2001-01-09T00:00:00.000Z'),
    i: at('2001-01-02T00:00:00.000Z'),
    j: at('2001-01-17T00:00:00.000Z'),
    k: at('2001-01-16T00:00:00.000Z'),
    l: at('2000-12-20T00:00:00.000Z'), // before the window
    admin: at('2001-01-02T00:00:00.000Z'),
    disabled: at('2001-01-10T00:00:00.000Z'),
    qa: at('2001-01-03T00:00:00.000Z'),
    owned: at('2001-01-04T00:00:00.000Z'),
    flagged: at('2001-01-05T00:00:00.000Z'),
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

  // A retry-missed attempt (RIN-914) is a normal attempt plus two optional fields.
  function retryAttempt(key: keyof typeof ids, takenAt: Date, quiz = sharedQuiz) {
    return { ...attempt(key, takenAt, quiz), retryOfAttemptId: id(), questionIndices: [1, 3] };
  }

  // A quick round (RIN-936) is a normal attempt over 10 chosen questions.
  function quickAttempt(key: keyof typeof ids, takenAt: Date, quiz = sharedQuiz) {
    const questionIndices = [16, 2, 9, 0, 11, 5, 14, 7, 3, 12];
    return { ...attempt(key, takenAt, quiz), mode: 'quick', questionIndices, totalQuestions: 10 };
  }

  function events(
    userId: string,
    firstCompletionAt: Date | null,
    completions: Date[],
    succeededUploads: Date[] = [],
  ): AdminAdaptiveLearnerEvents {
    return { userId, firstCompletionAt, completions, succeededUploads };
  }

  // Path B events as the API serves them (failed jobs are never listed).
  const adaptiveEvents = (): AdminAdaptiveLearnerEvents[] => [
    // A: on both paths in W01, counted once, in the `both` buckets.
    events(
      ids.a.toHexString(),
      plus(signup.a, 2 * DAY),
      [plus(signup.a, 2 * DAY)],
      [plus(signup.a, DAY)],
    ),
    // H: adaptive only. Completion on day 1, back on day 10 → activated and retained.
    events(
      ids.h.toHexString(),
      plus(signup.h, DAY),
      [plus(signup.h, DAY), plus(signup.h, 10 * DAY)],
      [plus(signup.h, 3_600_000)],
    ),
    // I: first adaptive completion in W01, first attempt (day 7) in W02 → north star W01.
    events(ids.i.toHexString(), plus(signup.i, DAY), [plus(signup.i, DAY)], [signup.i]),
    // K: succeeded upload on day 3, never completes → material only.
    events(ids.k.toHexString(), null, [], [plus(signup.k, 3 * DAY)]),
    // J: succeeded upload only on day 8 → not material.
    events(ids.j.toHexString(), null, [], [plus(signup.j, 8 * DAY)]),
    // L: first completion ever was before the window; an in-window one is not a first.
    events(ids.l.toHexString(), at('2000-12-25T00:00:00.000Z'), [at('2001-01-10T00:00:00.000Z')]),
    // Excluded, unknown and malformed ids are dropped.
    events(
      ids.disabled.toHexString(),
      at('2001-01-11T00:00:00.000Z'),
      [at('2001-01-11T00:00:00.000Z')],
      [at('2001-01-11T00:00:00.000Z')],
    ),
    events(id().toHexString(), at('2001-01-05T00:00:00.000Z'), [at('2001-01-05T00:00:00.000Z')]),
    events('not-an-object-id', at('2001-01-05T00:00:00.000Z'), [at('2001-01-05T00:00:00.000Z')]),
  ];

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
        user('h'),
        user('i'),
        user('j'),
        user('k'),
        user('l'),
        user('admin', { role: 'admin' }),
        user('disabled', { disable: 1 }),
        user('qa', { email: `${runId}-qa@example.test` }),
        user('owned', { email: owned.email }),
        // Ordinary address: excluded only by the admin-set flag.
        user('flagged', { isTestAccount: true }),
      ]);
      await db.collection('quizzes').insertMany([
        { ...quiz('shared'), _id: sharedQuiz, author: ids.admin, createdAt: signup.admin },
        { ...quiz('own-a'), _id: ownQuizA, author: ids.a, createdAt: plus(signup.a, DAY) },
        // D authors within 7 days and never attempts: material, not activated.
        { ...quiz('d'), author: ids.d, createdAt: plus(signup.d, 2 * DAY) },
        // C authors on day 7 exactly: outside the material window.
        { ...quiz('c'), author: ids.c, createdAt: plus(signup.c, 7 * DAY) },
        { ...quiz('flagged'), author: ids.flagged, createdAt: plus(signup.flagged, DAY) },
      ]);
      await db.collection('attempts').insertMany([
        // A: own quiz on day 1, back on day 8 → activated and retained.
        attempt('a', plus(signup.a, DAY + 3_600_000), ownQuizA),
        attempt('a', plus(signup.a, 8 * DAY)),
        // B: signs up Sunday of W01, first attempt Monday of W02 (cross-week),
        // returns 1 ms before day 14 → activated W01, retained, first attempt W02.
        // The return is a retry-missed attempt: it must count for w1Retained.
        attempt('b', at('2001-01-08T01:00:00.000Z')),
        retryAttempt('b', plus(signup.b, 14 * DAY - 1)),
        // C: first attempt exactly 7 days after signup → not activated; first attempt W02.
        attempt('c', plus(signup.c, 7 * DAY)),
        // E: activated by a quick round (counts like any attempt), returns exactly on
        // day 14 → not retained (window is days 7–13).
        quickAttempt('e', plus(signup.e, DAY)),
        attempt('e', plus(signup.e, 14 * DAY)),
        // F: first attempt before the window; a later one never counts as first.
        attempt('f', plus(signup.f, DAY)),
        attempt('f', at('2001-01-10T00:00:00.000Z')),
        // G: activated on signup day in W03, by a retry-missed attempt (counts like any attempt).
        retryAttempt('g', plus(signup.g, 3_600_000)),
        // I: first attempt exactly on day 7 → not quiz-activated, but a return.
        attempt('i', plus(signup.i, 7 * DAY)),
        // Excluded accounts are invisible everywhere.
        attempt('admin', at('2001-01-02T12:00:00.000Z')),
        attempt('disabled', at('2001-01-10T12:00:00.000Z')),
        attempt('qa', at('2001-01-03T12:00:00.000Z')),
        attempt('owned', at('2001-01-04T12:00:00.000Z')),
        // Flagged: would be activated and retained in W01 if it were counted.
        attempt('flagged', plus(signup.flagged, DAY)),
        attempt('flagged', plus(signup.flagged, 8 * DAY)),
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
      db.collection('auditlogs').deleteMany({ _integrationRun: runId }),
      db.collection('quizprogresses').deleteMany({ _integrationRun: runId }),
      db.collection('adminactionaudits').deleteMany({ actorId: ids.admin }),
    ]);
    await mongoose.disconnect();
  }, 10_000);

  const by = (quiz: number, adaptive: number, both: number) => ({ quiz, adaptive, both });
  const cohortBy = (quiz: number, adaptive: number, both: number, claimedGuest = 0) => ({
    ...by(quiz, adaptive, both),
    claimedGuest,
  });

  it('produces exact quiz-only cohort and first-attempt counts per ISO week', async () => {
    const aggregates = await new AdminStatsRepository().getActivationAggregates(W01, W04);

    expect(aggregates.cohorts).toEqual([
      {
        weekStart: W01,
        signups: 5,
        material: 3,
        activated: 2,
        activatedBy: cohortBy(2, 0, 0),
        w1Retained: 2,
        signedIn: 0,
        startedQuiz: 2,
        returnedWeek1: 1,
      },
      {
        weekStart: W02,
        signups: 2,
        material: 1,
        activated: 1,
        activatedBy: cohortBy(1, 0, 0),
        w1Retained: 0,
        signedIn: 0,
        startedQuiz: 1,
        returnedWeek1: 1,
      },
      {
        weekStart: W03,
        signups: 3,
        material: 1,
        activated: 1,
        activatedBy: cohortBy(1, 0, 0),
        w1Retained: 0,
        signedIn: 0,
        startedQuiz: 1,
        returnedWeek1: 0,
      },
    ]);
    expect(aggregates.firstAttempts).toEqual([
      { weekStart: W01, learners: 1, activatedBy: by(1, 0, 0) },
      { weekStart: W02, learners: 4, activatedBy: by(4, 0, 0) },
      { weekStart: W03, learners: 1, activatedBy: by(1, 0, 0) },
    ]);
  });

  it('merges Path B events, counting each learner once on the earliest path', async () => {
    const aggregates = await new AdminStatsRepository().getActivationAggregates(
      W01,
      W04,
      adaptiveEvents(),
    );

    expect(aggregates.cohorts).toEqual([
      // + I (adaptive). A is now `both`. I returns via the day-7 attempt.
      {
        weekStart: W01,
        signups: 5,
        material: 4,
        activated: 3,
        activatedBy: cohortBy(1, 1, 1),
        w1Retained: 3,
        signedIn: 0,
        startedQuiz: 3,
        returnedWeek1: 2,
      },
      // + H (adaptive), retained via the day-10 adaptive completion.
      {
        weekStart: W02,
        signups: 2,
        material: 2,
        activated: 2,
        activatedBy: cohortBy(1, 1, 0),
        w1Retained: 1,
        signedIn: 0,
        startedQuiz: 2,
        returnedWeek1: 2,
      },
      // + K's succeeded upload (material); J's day-8 upload does not count.
      {
        weekStart: W03,
        signups: 3,
        material: 2,
        activated: 1,
        activatedBy: cohortBy(1, 0, 0),
        w1Retained: 0,
        signedIn: 0,
        startedQuiz: 1,
        returnedWeek1: 0,
      },
    ]);
    expect(aggregates.firstAttempts).toEqual([
      // A (both firsts in W01) and I (adaptive W01, before its W02 attempt).
      { weekStart: W01, learners: 2, activatedBy: by(0, 1, 1) },
      // B, C, E by quiz; H by adaptive. I is no longer here; L never counts.
      { weekStart: W02, learners: 4, activatedBy: by(3, 1, 0) },
      { weekStart: W03, learners: 1, activatedBy: by(1, 0, 0) },
    ]);
  });

  it('counts the flagged learner in every series once the flag is cleared', async () => {
    const users = mongoose.connection.collection('users');
    await users.updateOne({ _id: ids.flagged }, { $set: { isTestAccount: false } });
    try {
      const aggregates = await new AdminStatsRepository().getActivationAggregates(W01, W04);
      expect(aggregates.cohorts[0]).toEqual({
        weekStart: W01,
        signups: 6,
        material: 4,
        activated: 3,
        activatedBy: cohortBy(3, 0, 0),
        w1Retained: 3,
        signedIn: 0,
        startedQuiz: 3,
        returnedWeek1: 2,
      });
      expect(aggregates.firstAttempts[0]).toEqual({
        weekStart: W01,
        learners: 2,
        activatedBy: by(2, 0, 0),
      });
    } finally {
      await users.updateOne({ _id: ids.flagged }, { $set: { isTestAccount: true } });
    }
  });

  it('serves the response contract with the 14-day completeness boundary and an audit entry', async () => {
    const adaptiveReader = vi.fn().mockResolvedValue(adaptiveEvents());
    const service = new ActivationStatsService({
      stats: new AdminStatsRepository(),
      activationEmail: new ActivationEmailStatsRepository(),
      audit: new AdminAuditRepository(),
      adaptiveEvents: adaptiveReader,
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
      { isoWeek: '2001-W01', w1Retained: 3, w1RetentionRate: 1, complete: true },
      { isoWeek: '2001-W02', w1Retained: 1, w1RetentionRate: 0.5, complete: true },
      { isoWeek: '2001-W03', w1Retained: null, w1RetentionRate: null, complete: false },
      { isoWeek: '2001-W04', w1Retained: null, w1RetentionRate: null, complete: false },
      { isoWeek: '2001-W05', w1Retained: null, w1RetentionRate: null, complete: false },
    ]);
    expect(result.data.weeks.map((week) => week.weeklyActivatedLearners)).toEqual([2, 4, 1, 0, 0]);
    // returnedWeek1 is final 7 days after the week ends: W03 ended 2001-01-22, now is 01-29.
    expect(result.data.weeks.map((week) => week.returnedWeek1)).toEqual([2, 2, 0, null, null]);
    expect(result.data.sources).toEqual({ adaptive: 'ok' });
    expect(adaptiveReader).toHaveBeenCalledWith(
      W01,
      at('2001-02-19T00:00:00.000Z'),
      ids.admin.toHexString(),
    );
    expect(JSON.stringify(result.data)).not.toContain(runId);
    expect(JSON.stringify(result.data)).not.toContain(ids.h.toHexString());

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

  /**
   * First-session funnel (RIN-932). Dated in 2100 so the 180-day TTL on
   * `auditlogs.createdAt` cannot delete the sign-ins mid-test. One UTC ISO
   * week, 2100-03-01 (Monday) to 2100-03-08.
   */
  it('counts the first-session funnel with Asia/Ho_Chi_Minh return days and UTC weeks', async () => {
    const db = mongoose.connection;
    const F01 = at('2100-03-01T00:00:00.000Z');
    const F03 = at('2100-03-15T00:00:00.000Z');
    const funnelIds = { n: id(), s: id(), r: id(), t: id(), u: id(), p: id(), v: id(), x: id() };
    const funnelSignup = {
      n: at('2100-03-01T10:00:00.000Z'), // never signs in; opens a quiz, answers nothing
      s: at('2100-03-01T18:00:00.000Z'), // 01:00 local on 03-02; back at 22:00 local, same local day
      r: at('2100-03-02T05:00:00.000Z'), // back on day 3
      t: at('2100-03-03T16:00:00.000Z'), // 23:00 local; back at 17:30 UTC = 00:30 local next day
      u: at('2100-03-07T23:30:00.000Z'), // Sunday 23:30 UTC = Monday local: stays in the UTC week
      p: at('2100-03-04T00:00:00.000Z'), // unsubmitted quiz with answers
      v: at('2100-03-05T00:00:00.000Z'), // claimed guest attempt on day 1
      x: at('2100-03-02T00:00:00.000Z'), // test account: does every step, counted in none
    };
    const learner = (key: keyof typeof funnelIds, extra: Record<string, unknown> = {}) => ({
      _id: funnelIds[key],
      _integrationRun: runId,
      email: `${runId}-funnel-${key}@learners.fixture`,
      role: 'user',
      disable: 0,
      authVersion: 0,
      createdAt: funnelSignup[key],
      updatedAt: funnelSignup[key],
      ...extra,
    });
    const login = (key: keyof typeof funnelIds, createdAt: Date) => ({
      _integrationRun: runId,
      userId: funnelIds[key],
      event: 'login_success',
      createdAt,
    });
    const progress = (key: keyof typeof funnelIds, answeredCount: number, updatedAt: Date) => ({
      _integrationRun: runId,
      userId: funnelIds[key],
      quiz: id(),
      answeredCount,
      updatedAt,
    });
    const funnelAttempt = (key: keyof typeof funnelIds, takenAt: Date, claimedAt?: Date) => ({
      _integrationRun: runId,
      user: funnelIds[key],
      quiz: sharedQuiz,
      takenAt,
      score: 50,
      ...(claimedAt ? { claimedAt } : {}),
    });

    await db
      .collection('users')
      .insertMany([
        learner('n'),
        learner('s'),
        learner('r'),
        learner('t'),
        learner('u'),
        learner('p'),
        learner('v'),
        learner('x', { isTestAccount: true }),
      ]);
    await db.collection('auditlogs').insertMany([
      login('s', plus(funnelSignup.s, 60_000)),
      login('s', at('2100-03-02T15:00:00.000Z')),
      login('r', plus(funnelSignup.r, 60_000)),
      login('r', plus(funnelSignup.r, 3 * DAY)),
      login('t', at('2100-03-03T17:30:00.000Z')),
      // Not a sign-in.
      { _integrationRun: runId, userId: funnelIds.n, event: 'login_failed', createdAt: F01 },
      login('x', funnelSignup.x),
      login('x', plus(funnelSignup.x, 3 * DAY)),
    ]);
    await db
      .collection('quizprogresses')
      .insertMany([
        progress('n', 0, plus(funnelSignup.n, 3_600_000)),
        progress('p', 2, plus(funnelSignup.p, 3_600_000)),
        progress('x', 3, plus(funnelSignup.x, 3_600_000)),
      ]);
    await db
      .collection('attempts')
      .insertMany([
        funnelAttempt('u', at('2100-03-08T01:00:00.000Z')),
        funnelAttempt('v', plus(funnelSignup.v, DAY), plus(funnelSignup.v, DAY + 60_000)),
        funnelAttempt('x', plus(funnelSignup.x, DAY), plus(funnelSignup.x, DAY + 60_000)),
      ]);

    const aggregates = await new AdminStatsRepository().getActivationAggregates(F01, F03);

    expect(aggregates.cohorts).toEqual([
      {
        weekStart: F01,
        signups: 7,
        // s, r, t. N never signs in.
        signedIn: 3,
        material: 2,
        // u and v attempted; p has an unsubmitted quiz; n answered nothing.
        startedQuiz: 3,
        activated: 2,
        activatedBy: cohortBy(2, 0, 0, 1),
        w1Retained: 0,
        // r (day 3), t (next local day), v (day-1 attempt). s and u came back
        // only on their local signup day.
        returnedWeek1: 3,
      },
    ]);
  });
});
