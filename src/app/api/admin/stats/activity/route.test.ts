import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminStatsListRouteMock, getActivityStatsMock } = vi.hoisted(() => ({
  createAdminStatsListRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
  getActivityStatsMock: vi.fn(),
}));

vi.mock('@/app/api/admin/stats/list-route', () => ({
  createAdminStatsListRoute: createAdminStatsListRouteMock,
}));
vi.mock('@/lib/admin-factory', () => ({
  getAdminService: () => ({
    getActivityStats: getActivityStatsMock,
  }),
}));

const activityPayload = {
  recentActivity: {
    users: [
      { email: 'new@example.com', createdAt: '2026-07-10T12:00:00.000Z' },
      { email: 'older-user@example.com', createdAt: '2026-07-08T12:00:00.000Z' },
    ],
    quizzes: [{ title: 'Algebra', createdAt: '2026-07-11T12:00:00.000Z' }],
    attempts: [{ id: 'attempt-1', takenAt: '2026-07-09T12:00:00.000Z' }],
  },
};

describe('GET /api/admin/stats/activity', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdminStatsListRouteMock.mockClear();
    getActivityStatsMock.mockReset();
    getActivityStatsMock.mockResolvedValue({ success: true, data: activityPayload });
  });

  it('wires activity stats mapping, logging, and pagination through the list route', async () => {
    const route = await import('@/app/api/admin/stats/activity/route');

    expect(route.dynamic).toBe('force-dynamic');
    expect(createAdminStatsListRouteMock).toHaveBeenCalledTimes(1);

    const options = createAdminStatsListRouteMock.mock.calls[0]?.[0] as
      | {
          load: () => Promise<unknown>;
          mapData: (
            data: typeof activityPayload,
            query: { page: number; limit: number },
          ) => {
            activities: Array<{ id: string; type: string; date: string; data: unknown }>;
            pagination: {
              currentPage: number;
              itemsPerPage: number;
              totalItems: number;
              totalPages: number;
              hasNextPage: boolean;
              hasPrevPage: boolean;
            };
          };
          logMessage: string;
          publicErrorMessage: string;
        }
      | undefined;
    expect(options).toBeDefined();
    if (!options) throw new Error('expected admin activity route options');

    expect(options.logMessage).toBe('Error fetching activity stats');
    expect(options.publicErrorMessage).toBe('Failed to fetch activity statistics');
    await options.load();
    expect(getActivityStatsMock).toHaveBeenCalledOnce();

    const page1 = options.mapData(activityPayload, { page: 1, limit: 2 });
    expect(page1.activities.map((item) => item.id)).toEqual([
      'quiz:Algebra:2026-07-11T12:00:00.000Z',
      'user:new@example.com:2026-07-10T12:00:00.000Z',
    ]);
    expect(page1.activities[0]).toMatchObject({
      type: 'quiz',
      date: '2026-07-11T12:00:00.000Z',
      data: { title: 'Algebra' },
    });
    expect(page1.pagination).toMatchObject({
      currentPage: 1,
      itemsPerPage: 2,
      totalItems: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });

    const page2 = options.mapData(activityPayload, { page: 2, limit: 2 });
    expect(page2.activities.map((item) => [item.type, item.id])).toEqual([
      ['attempt', 'attempt:attempt-1'],
      ['user', 'user:older-user@example.com:2026-07-08T12:00:00.000Z'],
    ]);
    expect(page2.pagination).toMatchObject({
      currentPage: 2,
      hasNextPage: false,
      hasPrevPage: true,
    });

    expect(route.GET).toBeTypeOf('function');
    expect(createAdminStatsListRouteMock.mock.results[0]?.value).toBe(route.GET);
  });
});
