import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { createAdminStatsListRoute } from '@/app/api/admin/stats/list-route';

function createRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/stats/example${query}`);
}

async function callRoute(handler: ReturnType<typeof createAdminStatsListRoute>, query = '') {
  return handler(createRequest(query), { params: Promise.resolve({}) });
}

describe('createAdminStatsListRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('validates pagination before loading service data', async () => {
    const load = vi.fn();
    const handler = createAdminStatsListRoute<unknown, unknown>({
      load,
      mapData: (data) => data,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load stats',
    });

    const response = await callRoute(handler, '?page=0&limit=101');

    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it('maps validated service data through the configured response mapper', async () => {
    const load = vi.fn().mockResolvedValue({ success: true, data: { count: 3 } });
    const handler = createAdminStatsListRoute<
      { count: number },
      { count: number; page: number; limit: number }
    >({
      load,
      mapData: (data, query) => ({ ...data, page: query.page, limit: query.limit }),
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load stats',
    });

    const response = await callRoute(handler, '?page=2&limit=5');

    expect(load).toHaveBeenCalledWith({ page: 2, limit: 5 });
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { count: 3, page: 2, limit: 5 },
    });
  });

  it('preserves typed service failures', async () => {
    const handler = createAdminStatsListRoute({
      load: vi.fn().mockResolvedValue({
        success: false,
        code: 'stats_unavailable',
        error: 'Stats are temporarily unavailable',
        statusCode: 503,
      }),
      mapData: (data) => data,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load stats',
    });

    const response = await callRoute(handler);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'stats_unavailable', detail: 'Stats are temporarily unavailable' },
    });
  });

  it('logs unexpected errors and returns the configured public message', async () => {
    const error = new Error('database unavailable');
    const handler = createAdminStatsListRoute({
      load: vi.fn().mockRejectedValue(error),
      mapData: (data) => data,
      logMessage: 'load failed',
      publicErrorMessage: 'Unable to load stats',
    });

    const response = await callRoute(handler);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error }, 'load failed');
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'internal_error', detail: 'Unable to load stats' },
    });
  });
});
