import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivationStatsService } from '@/services/admin/ActivationStatsService';

const { holder } = vi.hoisted(() => ({
  holder: { service: undefined as unknown },
}));

vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getActivationStatsService: () => holder.service,
}));

import { GET } from '@/app/api/admin/stats/activation/route';

const TOKEN = 'fake-analytics-token-0123456789abcdef';
const routeContext = { params: Promise.resolve({}) };
const DAY_MS = 86_400_000;
const NOW = new Date('2026-11-04T12:00:00.000Z'); // Wednesday of 2026-W45
const W44 = new Date('2026-10-26T00:00:00.000Z');
const W45 = new Date('2026-11-02T00:00:00.000Z');

/**
 * The default response captured from the route before RIN-1268 changed it,
 * for these fake aggregates at NOW. Re-stringified so the file's layout does
 * not matter; key order is kept, so the comparison is byte-for-byte.
 */
const DEFAULT_RESPONSE = JSON.stringify(
  JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'default-response.json'), 'utf8')),
);

const SEGMENT_ROWS = {
  locale: [
    { weekStart: W44, segment: 'en', signups: 4, activated: 2 },
    { weekStart: W44, segment: 'vi', signups: 5, activated: 2 },
    { weekStart: W44, segment: null, signups: 1, activated: 0 },
    { weekStart: W45, segment: 'vi', signups: 2, activated: 1 },
  ],
  country: [
    { weekStart: W44, segment: 'VN', signups: 5, activated: 2 },
    { weekStart: W44, segment: 'US', signups: 2, activated: 1 },
    { weekStart: W45, segment: 'US', signups: 1, activated: 0 },
    { weekStart: W44, segment: 'SG', signups: 1, activated: 1 },
    { weekStart: W45, segment: 'JP', signups: 1, activated: 0 },
    { weekStart: W44, segment: null, signups: 2, activated: 0 },
  ],
};

function makeService() {
  const deps = {
    stats: {
      getActivationAggregates: vi.fn().mockResolvedValue({
        cohorts: [
          {
            weekStart: W44,
            signups: 10,
            material: 7,
            activated: 4,
            activatedBy: { quiz: 2, adaptive: 1, both: 1, claimedGuest: 0 },
            w1Retained: 1,
            signedIn: 9,
            startedQuiz: 5,
            returnedWeek1: 3,
          },
        ],
        firstAttempts: [
          {
            weekStart: W45,
            learners: 5,
            activatedBy: { quiz: 3, adaptive: 2, both: 0 },
          },
        ],
      }),
    },
    segments: {
      getActivationSegments: vi.fn(
        async (_from: Date, _to: Date, by: 'locale' | 'country') => SEGMENT_ROWS[by],
      ),
    },
    activationEmail: { getWeeklySends: vi.fn().mockResolvedValue([]) },
    audit: { record: vi.fn().mockResolvedValue(undefined) },
    adaptiveEvents: vi.fn().mockResolvedValue([]),
    now: () => NOW,
  };
  return { deps, service: new ActivationStatsService(deps) };
}

function get(path: string): Promise<Response> {
  return GET(
    new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${TOKEN}` } }),
    routeContext,
  );
}

describe('GET /api/admin/stats/activation?by= (real service, fake aggregates)', () => {
  let deps: ReturnType<typeof makeService>['deps'];

  beforeEach(() => {
    vi.stubEnv('ANALYTICS_READ_TOKEN', TOKEN);
    const made = makeService();
    deps = made.deps;
    holder.service = made.service;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('serves the default response byte-for-byte as before RIN-1268', async () => {
    const response = await get('/api/admin/stats/activation?weeks=2');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(DEFAULT_RESPONSE);
    expect(deps.segments.getActivationSegments).not.toHaveBeenCalled();
  });

  it('splits signups and activated by locale, unknown for accounts without one', async () => {
    const response = await get('/api/admin/stats/activation?weeks=2&by=locale');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const { data } = await response.json();
    expect(deps.segments.getActivationSegments).toHaveBeenCalledWith(
      W44,
      new Date(W45.getTime() + 7 * DAY_MS),
      'locale',
      [],
    );
    expect(data.by).toBe('locale');
    expect(data.segments).toEqual(['en', 'vi', 'unknown']);
    expect(data.weeks).toEqual([
      {
        isoWeek: '2026-W44',
        start: '2026-10-26T00:00:00.000Z',
        end: '2026-11-01T23:59:59.999Z',
        complete: false,
        segments: {
          en: { signups: 4, activated: 2 },
          vi: { signups: 5, activated: 2 },
          unknown: { signups: 1, activated: 0 },
        },
      },
      {
        isoWeek: '2026-W45',
        start: '2026-11-02T00:00:00.000Z',
        end: '2026-11-08T23:59:59.999Z',
        complete: false,
        segments: {
          en: { signups: 0, activated: 0 },
          vi: { signups: 2, activated: 1 },
          unknown: { signups: 0, activated: 0 },
        },
      },
    ]);
  });

  it('splits by country and folds countries under 3 signups in the window into other', async () => {
    const response = await get('/api/admin/stats/activation?weeks=2&by=country');
    expect(response.status).toBe(200);
    const { data } = await response.json();
    // US has 2 + 1 = 3 over the window and stays; SG and JP (1 each) fold.
    expect(data.segments).toEqual(['VN', 'US', 'other', 'unknown']);
    expect(data.weeks.map((week: { segments: unknown }) => week.segments)).toEqual([
      {
        VN: { signups: 5, activated: 2 },
        US: { signups: 2, activated: 1 },
        other: { signups: 1, activated: 1 },
        unknown: { signups: 2, activated: 0 },
      },
      {
        VN: { signups: 0, activated: 0 },
        US: { signups: 1, activated: 0 },
        other: { signups: 1, activated: 0 },
        unknown: { signups: 0, activated: 0 },
      },
    ]);
  });

  it('caches per by: a locale read does not answer a country read or the default', async () => {
    await get('/api/admin/stats/activation?weeks=2&by=locale');
    await get('/api/admin/stats/activation?weeks=2&by=locale');
    const country = await (await get('/api/admin/stats/activation?weeks=2&by=country')).json();
    expect(country.data.by).toBe('country');
    expect(deps.segments.getActivationSegments).toHaveBeenCalledTimes(2);
    expect(await (await get('/api/admin/stats/activation?weeks=2')).text()).toBe(DEFAULT_RESPONSE);
    expect(deps.audit.record).toHaveBeenCalledTimes(4);
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ details: { weeks: '2', by: 'locale' } }),
    );
  });

  it('returns 400 for an unknown by', async () => {
    const response = await get('/api/admin/stats/activation?weeks=2&by=city');
    expect(response.status).toBe(400);
    expect(deps.segments.getActivationSegments).not.toHaveBeenCalled();
    expect(deps.audit.record).not.toHaveBeenCalled();
  });
});
