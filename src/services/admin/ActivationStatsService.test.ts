import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { adminActivationStatsSchema } from '@/dtos/admin-stats';
import { logger } from '@/lib/logger';
import { ActivationStatsService } from './ActivationStatsService';

// Spec values (RIN-463 AC 4/5), asserted as literals so a change is deliberate.
const CACHE_TTL_MS = 10 * 60_000;
const SERVICE_ACTOR = 'service:analytics-read';
const SERVICE_ACTOR_ID = '000000000000000000000000';

const NOW = new Date('2026-11-04T12:00:00.000Z'); // Wednesday of 2026-W45
const ADAPTIVE_LEARNER = '64b0000000000000000000a1'; // fake id
const ADAPTIVE_EVENTS = [
  {
    userId: ADAPTIVE_LEARNER,
    firstCompletionAt: new Date('2026-10-20T08:00:00.000Z'),
    completions: [new Date('2026-10-20T08:00:00.000Z')],
    succeededUploads: [new Date('2026-10-20T07:00:00.000Z')],
  },
];

function setup(now = NOW) {
  let clock = now.getTime();
  const stats = {
    getActivationAggregates: vi.fn().mockResolvedValue({
      cohorts: [
        {
          weekStart: new Date('2026-10-12T00:00:00.000Z'),
          signups: 10,
          material: 7,
          activated: 4,
          activatedBy: { quiz: 2, adaptive: 1, both: 1, claimedGuest: 1, claimedGuestDraft: 1 },
          w1Retained: 1,
          signedIn: 9,
          startedQuiz: 5,
          returnedWeek1: 3,
        },
        {
          weekStart: new Date('2026-11-02T00:00:00.000Z'),
          signups: 3,
          material: 2,
          activated: 1,
          activatedBy: { quiz: 1, adaptive: 0, both: 0, claimedGuest: 0, claimedGuestDraft: 0 },
          w1Retained: 1,
          signedIn: 3,
          startedQuiz: 2,
          returnedWeek1: 1,
        },
      ],
      firstAttempts: [
        {
          weekStart: new Date('2026-10-19T00:00:00.000Z'),
          learners: 5,
          activatedBy: { quiz: 3, adaptive: 2, both: 0 },
        },
      ],
      cohortEntries: [
        {
          weekStart: new Date('2026-10-12T00:00:00.000Z'),
          activatedByEntry: {
            blog: 2,
            landing: 1,
            post_signin_starter: 0,
            activation_email: 0,
            hub: 0,
            none: 1,
          },
          blogPosts: [
            { post: 'on-thi-toeic', activated: 1 },
            { post: 'hoc-tu-vung', activated: 1 },
          ],
        },
      ],
    }),
  };
  const activationEmail = {
    getWeeklySends: vi.fn().mockResolvedValue([
      // W43: both triggers, summed into the week totals.
      {
        weekStart: new Date('2026-10-19T00:00:00.000Z'),
        trigger: '24h',
        sent: 4,
        clicked: 1,
        activatedWithin7d: 2,
      },
      {
        weekStart: new Date('2026-10-19T00:00:00.000Z'),
        trigger: 'backfill',
        sent: 3,
        clicked: 0,
        activatedWithin7d: 1,
      },
      // A week outside the window is dropped, not appended.
      {
        weekStart: new Date('2026-09-28T00:00:00.000Z'),
        trigger: '24h',
        sent: 9,
        clicked: 9,
        activatedWithin7d: 9,
      },
    ]),
  };
  const guestFunnel = {
    getWeeklyGuestFunnel: vi.fn().mockResolvedValue([
      {
        weekStart: new Date('2026-10-26T00:00:00.000Z'),
        guestCompleted: 5,
        guestClaimed7d: 2,
        reviewOptInFromGuest: 1,
      },
      // A week outside the window is dropped, not appended.
      {
        weekStart: new Date('2026-09-28T00:00:00.000Z'),
        guestCompleted: 9,
        guestClaimed7d: 9,
        reviewOptInFromGuest: 9,
      },
    ]),
  };
  const uploads = {
    listDaily: vi.fn().mockResolvedValue([
      {
        day: '2026-10-27',
        kind: 'file_rejected',
        surface: 'create_pdf',
        ext: 'docx',
        reason: 'wrong_type',
        count: 3,
      },
      {
        day: '2026-10-28',
        kind: 'file_rejected',
        surface: 'try_pdf',
        ext: 'docx',
        reason: 'wrong_type',
        count: 2,
      },
      {
        day: '2026-10-28',
        kind: 'file_rejected',
        surface: 'try_pdf',
        ext: 'pptx',
        reason: 'wrong_type',
        count: 4,
      },
      {
        day: '2026-10-29',
        kind: 'office_draft_created',
        surface: 'create_pdf',
        ext: 'docx',
        reason: '',
        count: 1,
      },
      // Outside the window: dropped.
      {
        day: '2026-09-01',
        kind: 'file_rejected',
        surface: 'try_pdf',
        ext: 'zip',
        reason: 'wrong_type',
        count: 9,
      },
    ]),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const adaptiveEvents = vi.fn().mockResolvedValue(ADAPTIVE_EVENTS);
  const segments = { getActivationSegments: vi.fn().mockResolvedValue([]) };
  const service = new ActivationStatsService({
    stats,
    segments,
    activationEmail,
    guestFunnel,
    uploads,
    audit,
    adaptiveEvents,
    now: () => new Date(clock),
  });
  return {
    service,
    stats,
    activationEmail,
    guestFunnel,
    uploads,
    audit,
    adaptiveEvents,
    advance: (ms: number) => (clock += ms),
  };
}

describe('ActivationStatsService', () => {
  it('builds oldest-to-newest ISO weeks with the partial week last', async () => {
    const { service, stats } = setup();
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    expect(stats.getActivationAggregates).toHaveBeenCalledWith(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
      ADAPTIVE_EVENTS,
    );
    expect(result.data.timezone).toBe('UTC');
    expect(result.data.sources).toEqual({ adaptive: 'ok' });
    expect(result.data.weeks.map((week) => week.isoWeek)).toEqual([
      '2026-W42',
      '2026-W43',
      '2026-W44',
      '2026-W45',
    ]);
    expect(result.data.weeks[0]).toEqual({
      isoWeek: '2026-W42',
      start: '2026-10-12T00:00:00.000Z',
      end: '2026-10-18T23:59:59.999Z',
      signups: 10,
      signedIn: 9,
      material: 7,
      startedQuiz: 5,
      activated: 4,
      activatedBy: { quiz: 2, adaptive: 1, both: 1, claimedGuest: 1, claimedGuestDraft: 1 },
      weeklyActivatedLearners: 0,
      weeklyActivatedBy: { quiz: 0, adaptive: 0, both: 0 },
      w1Retained: 1,
      w1RetentionRate: 0.25,
      returnedWeek1: 3,
      complete: true,
      activatedByEntry: {
        blog: 2,
        landing: 1,
        post_signin_starter: 0,
        activation_email: 0,
        hub: 0,
        none: 1,
      },
      blogPosts: [
        { post: 'on-thi-toeic', activated: 1 },
        { post: 'hoc-tu-vung', activated: 1 },
      ],
    });
    // W43 ended 2026-10-26; 14 days later is 2026-11-09, after NOW.
    expect(result.data.weeks[1]).toMatchObject({
      signedIn: 0,
      startedQuiz: 0,
      activatedBy: { quiz: 0, adaptive: 0, both: 0, claimedGuest: 0, claimedGuestDraft: 0 },
      weeklyActivatedLearners: 5,
      weeklyActivatedBy: { quiz: 3, adaptive: 2, both: 0 },
      w1Retained: null,
      w1RetentionRate: null,
      // W43 ended 2026-10-26; 7 days later is 2026-11-02, before NOW.
      returnedWeek1: 0,
      complete: false,
      // RIN-1256: a week without a cohort row splits nothing.
      activatedByEntry: {
        blog: 0,
        landing: 0,
        post_signin_starter: 0,
        activation_email: 0,
        hub: 0,
        none: 0,
      },
      blogPosts: [],
    });
    // W44 ended 2026-11-02; 7 days later is 2026-11-09, after NOW.
    expect(result.data.weeks[2]?.returnedWeek1).toBeNull();
    // Retention stays hidden on young cohorts even when the store has data.
    expect(result.data.weeks[3]).toMatchObject({
      signups: 3,
      activated: 1,
      w1Retained: null,
      signedIn: 3,
      startedQuiz: 2,
      returnedWeek1: null,
      complete: false,
    });
  });

  it('adds activation-email sends per window week, split by trigger (RIN-1001)', async () => {
    const { service, activationEmail } = setup();
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    // Same window and the same adaptive read as the funnel.
    expect(activationEmail.getWeeklySends).toHaveBeenCalledWith(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
      ADAPTIVE_EVENTS,
    );
    const none = { sent: 0, clicked: 0, activatedWithin7d: 0 };
    expect(result.data.activationEmail.weeks).toEqual([
      { isoWeek: '2026-W42', ...none, byTrigger: { '24h': none, backfill: none } },
      {
        isoWeek: '2026-W43',
        sent: 7,
        clicked: 1,
        activatedWithin7d: 3,
        byTrigger: {
          '24h': { sent: 4, clicked: 1, activatedWithin7d: 2 },
          backfill: { sent: 3, clicked: 0, activatedWithin7d: 1 },
        },
      },
      { isoWeek: '2026-W44', ...none, byTrigger: { '24h': none, backfill: none } },
      { isoWeek: '2026-W45', ...none, byTrigger: { '24h': none, backfill: none } },
    ]);
    expect(result.data.definitions.activationEmail).toMatch(/send \+ 7 days/);
  });

  it('adds guest funnel counts per window week with definitions (RIN-1711)', async () => {
    const { service, guestFunnel } = setup();
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    expect(guestFunnel.getWeeklyGuestFunnel).toHaveBeenCalledWith(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
    );
    const none = { guestCompleted: 0, guestClaimed7d: 0, reviewOptInFromGuest: 0 };
    expect(result.data.guestFunnel.weeks).toEqual([
      { isoWeek: '2026-W42', ...none },
      { isoWeek: '2026-W43', ...none },
      { isoWeek: '2026-W44', guestCompleted: 5, guestClaimed7d: 2, reviewOptInFromGuest: 1 },
      { isoWeek: '2026-W45', ...none },
    ]);
    expect(result.data.definitions.guestCompleted).toMatch(/excluded account/);
    expect(result.data.definitions.guestClaimed7d).toMatch(/7 days/);
    expect(result.data.definitions.reviewOptInFromGuest).toMatch(/guest_result_review/);
  });

  it('adds upload rejections (top 10 + other) and office drafts per week (RIN-1785)', async () => {
    const { service, uploads } = setup();
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    expect(uploads.listDaily).toHaveBeenCalledWith('2026-10-12', '2026-11-08');
    const week = result.data.uploads.weeks.find((row) => row.isoWeek === '2026-W44');
    expect(week).toEqual({
      isoWeek: '2026-W44',
      uploadRejections: [
        { ext: 'docx', reason: 'wrong_type', count: 5 },
        { ext: 'pptx', reason: 'wrong_type', count: 4 },
      ],
      officeDrafts: [{ surface: 'create_pdf', ext: 'docx', count: 1 }],
    });
    expect(result.data.uploads.weeks[0]).toMatchObject({ uploadRejections: [], officeDrafts: [] });
    expect(result.data.definitions.uploadRejections).toMatch(/no file name/);
  });

  it('folds upload rejections beyond the top 10 into one other row', async () => {
    const { service, uploads } = setup();
    uploads.listDaily.mockResolvedValueOnce(
      Array.from({ length: 12 }, (_, index) => ({
        day: '2026-10-27',
        kind: 'file_rejected',
        surface: 'try_pdf',
        ext: `e${String(index).padStart(2, '0')}`,
        reason: 'wrong_type',
        count: 12 - index,
      })),
    );
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);
    const rows = result.data.uploads.weeks.find(
      (row) => row.isoWeek === '2026-W44',
    )?.uploadRejections;
    expect(rows).toHaveLength(11);
    expect(rows?.[10]).toEqual({ ext: 'other', reason: 'other', count: 3 });
  });

  it('counts activation-email sends quiz-only when the adaptive API fails', async () => {
    const { service, activationEmail, adaptiveEvents } = setup();
    adaptiveEvents.mockRejectedValueOnce(new Error('timeout'));
    await service.getWeeklyActivation(4, { kind: 'service' });
    expect(activationEmail.getWeeklySends).toHaveBeenLastCalledWith(
      expect.any(Date),
      expect.any(Date),
      [],
    );
  });

  it('reads adaptive events from the first week to 14 days after the last, as the actor', async () => {
    const { service, adaptiveEvents } = setup();
    await service.getWeeklyActivation(4, {
      kind: 'admin',
      userId: '64b000000000000000000001',
      email: 'admin@example.com',
    });
    expect(adaptiveEvents).toHaveBeenCalledWith(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-23T00:00:00.000Z'),
      '64b000000000000000000001',
    );
    await service.getWeeklyActivation(2, { kind: 'service' });
    expect(adaptiveEvents).toHaveBeenLastCalledWith(
      expect.any(Date),
      expect.any(Date),
      SERVICE_ACTOR_ID,
    );
  });

  it('answers quiz-only with sources.adaptive unavailable, uncached, when the API fails', async () => {
    const { service, stats, adaptiveEvents } = setup();
    adaptiveEvents.mockRejectedValueOnce(
      new Error('adaptive activation events unavailable: status 504'),
    );
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    expect(result.data.sources).toEqual({ adaptive: 'unavailable' });
    expect(stats.getActivationAggregates).toHaveBeenLastCalledWith(
      expect.any(Date),
      expect.any(Date),
      [],
    );
    expect(result.data.weeks[0]?.activated).toBe(4);
    expect(logger.warn).toHaveBeenCalledWith(
      { reason: 'adaptive activation events unavailable: status 504' },
      expect.any(String),
    );

    // Not cached: the next read retries the API and caches the full answer.
    const retry = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!retry.success) throw new Error(retry.error);
    expect(retry.data.sources).toEqual({ adaptive: 'ok' });
    expect(adaptiveEvents).toHaveBeenCalledTimes(2);
    await service.getWeeklyActivation(4, { kind: 'service' });
    expect(adaptiveEvents).toHaveBeenCalledTimes(2);
    expect(stats.getActivationAggregates).toHaveBeenCalledTimes(2);
  });

  it('marks a week complete exactly 14 days after it ends', async () => {
    const { service } = setup(new Date('2026-11-02T00:00:00.000Z'));
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);
    expect(result.data.weeks.map((week) => week.complete)).toEqual([true, false, false, false]);
  });

  it('caches results for 10 minutes but audits every call', async () => {
    const { service, stats, audit, advance } = setup();
    await service.getWeeklyActivation(8, {
      kind: 'admin',
      userId: '64b000000000000000000001',
      email: 'admin@example.com',
    });
    advance(CACHE_TTL_MS - 1);
    await service.getWeeklyActivation(8, { kind: 'service' });
    expect(stats.getActivationAggregates).toHaveBeenCalledTimes(1);
    await service.getWeeklyActivation(4, { kind: 'service' });
    expect(stats.getActivationAggregates).toHaveBeenCalledTimes(2);
    advance(1);
    await service.getWeeklyActivation(8, { kind: 'service' });
    expect(stats.getActivationAggregates).toHaveBeenCalledTimes(3);

    expect(audit.record).toHaveBeenCalledTimes(4);
    expect(audit.record).toHaveBeenNthCalledWith(1, {
      actorId: '64b000000000000000000001',
      actorEmail: 'admin@example.com',
      action: 'stats.activation.read',
      entityType: 'stats',
      entityId: 'activation',
      details: { weeks: '8' },
    });
    expect(audit.record).toHaveBeenNthCalledWith(2, {
      actorId: SERVICE_ACTOR_ID,
      actorEmail: SERVICE_ACTOR,
      action: 'stats.activation.read',
      entityType: 'stats',
      entityId: 'activation',
      details: { weeks: '8' },
    });
  });

  it('fails closed when the audit write fails', async () => {
    const { service, stats, audit } = setup();
    audit.record.mockRejectedValueOnce(new Error('db down'));
    const result = await service.getWeeklyActivation(8, { kind: 'service' });
    expect(result).toMatchObject({ success: false, statusCode: 500 });
    expect(stats.getActivationAggregates).not.toHaveBeenCalled();
  });

  it('returns only aggregates: no emails, ids, ObjectIds or titles', async () => {
    const { service } = setup();
    const result = await service.getWeeklyActivation(26, { kind: 'service' });
    if (!result.success) throw new Error(result.error);
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toMatch(/\b[a-f0-9]{24}\b/i);
    expect(serialized).not.toMatch(/"(?:_id|id|userId|email|name|title)"/);

    for (const week of result.data.activationEmail.weeks) {
      expect(Object.keys(week).sort()).toEqual([
        'activatedWithin7d',
        'byTrigger',
        'clicked',
        'isoWeek',
        'sent',
      ]);
    }
    for (const week of result.data.weeks) {
      for (const [key, value] of Object.entries(week)) {
        if (['isoWeek', 'start', 'end'].includes(key)) expect(typeof value).toBe('string');
        else if (key === 'complete') expect(typeof value).toBe('boolean');
        else if (key === 'activatedBy') {
          expect(Object.keys(value as object).sort()).toEqual([
            'adaptive',
            'both',
            'claimedGuest',
            'claimedGuestDraft',
            'quiz',
          ]);
        } else if (key === 'weeklyActivatedBy') {
          expect(Object.keys(value as object).sort()).toEqual(['adaptive', 'both', 'quiz']);
        } else if (key === 'activatedByEntry') {
          expect(Object.keys(value as object).sort()).toEqual([
            'activation_email',
            'blog',
            'hub',
            'landing',
            'none',
            'post_signin_starter',
          ]);
        } else if (key === 'blogPosts') {
          for (const row of value as object[]) {
            expect(Object.keys(row).sort()).toEqual(['activated', 'post']);
          }
        } else expect(value === null || typeof value === 'number').toBe(true);
      }
    }
  });

  it('has a strict response schema that rejects extra keys at every level', async () => {
    const { service } = setup();
    const result = await service.getWeeklyActivation(2, { kind: 'service' });
    if (!result.success) throw new Error(result.error);
    const valid = result.data;
    expect(adminActivationStatsSchema.safeParse(valid).success).toBe(true);
    expect(adminActivationStatsSchema.safeParse({ ...valid, email: 'x' }).success).toBe(false);
    expect(
      adminActivationStatsSchema.safeParse({
        ...valid,
        definitions: { ...valid.definitions, extra: 'x' },
      }).success,
    ).toBe(false);
    expect(
      adminActivationStatsSchema.safeParse({
        ...valid,
        weeks: [{ ...valid.weeks[0], userIds: ['64b000000000000000000001'] }],
      }).success,
    ).toBe(false);
    expect(
      adminActivationStatsSchema.safeParse({
        ...valid,
        weeks: [
          {
            ...valid.weeks[0],
            activatedBy: {
              quiz: 0,
              adaptive: 0,
              both: 0,
              claimedGuest: 0,
              claimedGuestDraft: 0,
              userIds: [ADAPTIVE_LEARNER],
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      adminActivationStatsSchema.safeParse({
        ...valid,
        sources: { adaptive: 'ok', learners: [ADAPTIVE_LEARNER] },
      }).success,
    ).toBe(false);
    const emailWeek = valid.activationEmail.weeks[0];
    if (!emailWeek) throw new Error('no activation-email week');
    for (const leak of [
      { weeks: [{ ...emailWeek, emails: ['x'] }] },
      {
        weeks: [
          {
            ...emailWeek,
            byTrigger: { ...emailWeek.byTrigger, manual: emailWeek.byTrigger['24h'] },
          },
        ],
      },
      {
        weeks: [
          {
            ...emailWeek,
            byTrigger: {
              ...emailWeek.byTrigger,
              backfill: { ...emailWeek.byTrigger.backfill, userIds: [] },
            },
          },
        ],
      },
      { weeks: [], recipients: [] },
    ]) {
      expect(
        adminActivationStatsSchema.safeParse({ ...valid, activationEmail: leak }).success,
      ).toBe(false);
    }
  });
});
