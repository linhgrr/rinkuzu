import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getTelemetryMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getTelemetryMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/entitlements/telemetry', () => ({
  getEntitlementTelemetry: getTelemetryMock,
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { dynamic, GET } from './route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/admin/entitlement-usage${query}`);
}

describe('GET /api/admin/entitlement-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession);
    getTelemetryMock.mockResolvedValue({ windowDays: 30, totals: {}, byCapability: [] });
  });

  it('is dynamic and requires an admin session', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);
    authMock.mockResolvedValueOnce({ user: { ...adminSession.user, role: 'user' } });
    expect((await GET(request(), routeContext)).status).toBe(403);
    expect(getTelemetryMock).not.toHaveBeenCalled();
  });

  it('validates the window and maps it to day count', async () => {
    expect((await GET(request('?window=365d'), routeContext)).status).toBe(400);
    const response = await GET(request('?window=90d'), routeContext);
    expect(response.status).toBe(200);
    expect(getTelemetryMock).toHaveBeenCalledWith(90);
  });

  it('returns a safe error when aggregation fails', async () => {
    getTelemetryMock.mockRejectedValueOnce(new Error('db down'));
    const response = await GET(request(), routeContext);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch entitlement telemetry' },
    });
    expect(loggerErrorMock).toHaveBeenCalled();
  });
});
