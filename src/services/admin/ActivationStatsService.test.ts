import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { adminActivationStatsSchema } from '@/dtos/admin-stats';
import {
  ACTIVATION_STATS_CACHE_TTL_MS,
  ActivationStatsService,
  ANALYTICS_SERVICE_ACTOR,
  ANALYTICS_SERVICE_ACTOR_ID,
} from './ActivationStatsService';

const NOW = new Date('2026-11-04T12:00:00.000Z'); // Wednesday of 2026-W45

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
          w1Retained: 1,
        },
        {
          weekStart: new Date('2026-11-02T00:00:00.000Z'),
          signups: 3,
          material: 2,
          activated: 1,
          w1Retained: 1,
        },
      ],
      firstAttempts: [{ weekStart: new Date('2026-10-19T00:00:00.000Z'), learners: 5 }],
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new ActivationStatsService({ stats, audit, now: () => new Date(clock) });
  return { service, stats, audit, advance: (ms: number) => (clock += ms) };
}

describe('ActivationStatsService', () => {
  it('builds oldest-to-newest ISO weeks with the partial week last', async () => {
    const { service, stats } = setup();
    const result = await service.getWeeklyActivation(4, { kind: 'service' });
    if (!result.success) throw new Error(result.error);

    expect(stats.getActivationAggregates).toHaveBeenCalledWith(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-11-09T00:00:00.000Z'),
    );
    expect(result.data.timezone).toBe('UTC');
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
      material: 7,
      activated: 4,
      weeklyActivatedLearners: 0,
      w1Retained: 1,
      w1RetentionRate: 0.25,
      complete: true,
    });
    // W43 ended 2026-10-26; 14 days later is 2026-11-09, after NOW.
    expect(result.data.weeks[1]).toMatchObject({
      weeklyActivatedLearners: 5,
      w1Retained: null,
      w1RetentionRate: null,
      complete: false,
    });
    // Retention stays hidden on young cohorts even when the store has data.
    expect(result.data.weeks[3]).toMatchObject({
      signups: 3,
      activated: 1,
      w1Retained: null,
      complete: false,
    });
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
    advance(ACTIVATION_STATS_CACHE_TTL_MS - 1);
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
      actorId: ANALYTICS_SERVICE_ACTOR_ID,
      actorEmail: ANALYTICS_SERVICE_ACTOR,
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

    for (const week of result.data.weeks) {
      for (const [key, value] of Object.entries(week)) {
        if (['isoWeek', 'start', 'end'].includes(key)) expect(typeof value).toBe('string');
        else if (key === 'complete') expect(typeof value).toBe('boolean');
        else expect(value === null || typeof value === 'number').toBe(true);
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
  });
});
