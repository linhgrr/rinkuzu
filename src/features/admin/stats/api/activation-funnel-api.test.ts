import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchApiDataMock } = vi.hoisted(() => ({ fetchApiDataMock: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ fetchApiData: fetchApiDataMock }));

import { fetchActivationFunnelViewModel } from '@/features/admin/stats/api/admin-stats-api';

function week(isoWeek: string, start: string, end: string, returnedWeek1: number | null) {
  return {
    isoWeek,
    start,
    end,
    signups: 3,
    signedIn: 2,
    material: 2,
    startedQuiz: 2,
    activated: 1,
    returnedWeek1,
  };
}

describe('fetchActivationFunnelViewModel', () => {
  beforeEach(() => fetchApiDataMock.mockReset());

  it('asks for 8 weeks, puts the newest first and marks the week that contains generatedAt', async () => {
    fetchApiDataMock.mockResolvedValue({
      generatedAt: '2026-11-05T15:00:00.000Z',
      sources: { adaptive: 'unavailable' },
      weeks: [
        week('2026-W44', '2026-10-26T00:00:00.000Z', '2026-11-01T23:59:59.999Z', null),
        week('2026-W45', '2026-11-02T00:00:00.000Z', '2026-11-08T23:59:59.999Z', null),
      ],
      activationEmail: {
        weeks: [
          {
            isoWeek: '2026-W44',
            sent: 5,
            clicked: 1,
            activatedWithin7d: 2,
            byTrigger: {
              '24h': { sent: 4, clicked: 1, activatedWithin7d: 2 },
              backfill: { sent: 1, clicked: 0, activatedWithin7d: 0 },
            },
          },
          {
            isoWeek: '2026-W45',
            sent: 0,
            clicked: 0,
            activatedWithin7d: 0,
            byTrigger: {
              '24h': { sent: 0, clicked: 0, activatedWithin7d: 0 },
              backfill: { sent: 0, clicked: 0, activatedWithin7d: 0 },
            },
          },
        ],
      },
    });

    const result = await fetchActivationFunnelViewModel();

    expect(fetchApiDataMock.mock.calls[0]?.[0]).toBe('/api/admin/stats/activation?weeks=8');
    expect(result.adaptiveAvailable).toBe(false);
    expect(result.weeks.map((row) => [row.isoWeek, row.monday, row.inProgress])).toEqual([
      ['2026-W45', '2026-11-02', true],
      ['2026-W44', '2026-10-26', false],
    ]);
    expect(Object.keys(result.weeks[0] ?? {})).not.toContain('material');
    expect(result.emailWeeks).toEqual([
      {
        isoWeek: '2026-W45',
        monday: '2026-11-02',
        sent: 0,
        sentDay1: 0,
        sentBackfill: 0,
        clicked: 0,
        activatedWithin7d: 0,
        inProgress: true,
      },
      {
        isoWeek: '2026-W44',
        monday: '2026-10-26',
        sent: 5,
        sentDay1: 4,
        sentBackfill: 1,
        clicked: 1,
        activatedWithin7d: 2,
        inProgress: false,
      },
    ]);
  });
});
