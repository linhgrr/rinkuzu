import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));

import { createAdminReportIdRoute } from '@/app/api/admin/reports/[id]/report-id-route';

const request = new NextRequest('http://localhost/api/admin/reports/507f1f77bcf86cd799439011');
const routeContext = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) };

describe('createAdminReportIdRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('validates the report id before invoking the handler', async () => {
    const handle = vi.fn();
    const route = createAdminReportIdRoute({
      handle,
      logMessage: 'report failed',
      publicErrorMessage: 'Unable to update report',
    });

    const response = await route(request, { params: Promise.resolve({ id: 'not-an-object-id' }) });

    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it('passes the validated id, admin email, and request to the handler', async () => {
    const handle = vi.fn().mockResolvedValue(new Response('ok'));
    const route = createAdminReportIdRoute({
      handle,
      logMessage: 'report failed',
      publicErrorMessage: 'Unable to update report',
    });

    await route(request, routeContext);

    expect(handle).toHaveBeenCalledWith({
      request,
      id: '507f1f77bcf86cd799439011',
      userId: 'admin-1',
      email: 'admin@example.com',
    });
  });

  it('logs unexpected handler errors and returns a safe public response', async () => {
    const error = new Error('database unavailable');
    const route = createAdminReportIdRoute({
      handle: vi.fn().mockRejectedValue(error),
      logMessage: 'report failed',
      publicErrorMessage: 'Unable to update report',
    });

    const response = await route(request, routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error }, 'report failed');
  });
});
