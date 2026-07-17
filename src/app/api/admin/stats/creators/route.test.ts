import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminStatsListRouteMock, getCreatorStatsMock } = vi.hoisted(() => ({
  createAdminStatsListRouteMock: vi.fn((..._args: unknown[]) => vi.fn()),
  getCreatorStatsMock: vi.fn(),
}));

vi.mock('@/app/api/admin/stats/list-route', () => ({
  createAdminStatsListRoute: createAdminStatsListRouteMock,
}));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getAdminService: () => ({
      getCreatorStats: getCreatorStatsMock,
    }),
  },
}));

describe('GET /api/admin/stats/creators', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdminStatsListRouteMock.mockClear();
    getCreatorStatsMock.mockReset();
    getCreatorStatsMock.mockResolvedValue({ success: true, data: { creators: [] } });
  });

  it('wires creator stats through the shared admin stats list route', async () => {
    const route = await import('@/app/api/admin/stats/creators/route');

    expect(route.dynamic).toBe('force-dynamic');
    expect(createAdminStatsListRouteMock).toHaveBeenCalledTimes(1);

    const options = createAdminStatsListRouteMock.mock.calls[0]?.[0] as
      | {
          load: (query: { page: number; limit: number }) => Promise<unknown>;
          mapData: (data: unknown) => unknown;
          logMessage: string;
          publicErrorMessage: string;
        }
      | undefined;
    expect(options).toBeDefined();
    if (!options) throw new Error('expected creator stats route options');

    expect(options.logMessage).toBe('Error fetching creator stats');
    expect(options.publicErrorMessage).toBe('Failed to fetch creator statistics');
    expect(options.mapData({ creators: [1] })).toEqual({ creators: [1] });

    await options.load({ page: 2, limit: 5 });
    expect(getCreatorStatsMock).toHaveBeenCalledWith({ page: 2, limit: 5 });

    expect(route.GET).toBeTypeOf('function');
    expect(createAdminStatsListRouteMock.mock.results[0]?.value).toBe(route.GET);
  });
});
