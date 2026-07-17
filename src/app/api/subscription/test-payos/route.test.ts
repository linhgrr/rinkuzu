import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, testConnectionMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  testConnectionMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/payment/PayOSService', () => ({
  PayOSService: class PayOSService {
    testConnection = testConnectionMock;
  },
}));

import { dynamic, GET } from '@/app/api/subscription/test-payos/route';

const routeContext = { params: Promise.resolve({}) };

function adminSession() {
  return { user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' } };
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/subscription/test-payos');
}

describe('GET /api/subscription/test-payos', () => {
  const envKeys = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'] as const;
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    testConnectionMock.mockResolvedValue(true);
    for (const key of envKeys) {
      process.env[key] = `value-for-${key}`;
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('is force-dynamic and requires admin', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await GET(request(), routeContext)).status).toBe(401);
    expect(testConnectionMock).not.toHaveBeenCalled();
  });

  it('returns environment presence flags when PayOS connects', async () => {
    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        environment: {
          clientId: true,
          apiKey: true,
          checksumKey: true,
          baseUrl: 'https://api-merchant.payos.vn',
        },
      },
      meta: { message: 'PayOS service is working correctly' },
    });
  });

  it('reports missing env vars as false and maps connection failures to 503', async () => {
    delete process.env['PAYOS_CLIENT_ID'];
    delete process.env['PAYOS_API_KEY'];
    delete process.env['PAYOS_CHECKSUM_KEY'];

    const ok = await GET(request(), routeContext);
    await expect(ok.json()).resolves.toMatchObject({
      data: {
        environment: {
          clientId: false,
          apiKey: false,
          checksumKey: false,
          baseUrl: 'https://api-merchant.payos.vn',
        },
      },
    });

    testConnectionMock.mockResolvedValueOnce(false);
    const failed = await GET(request(), routeContext);
    expect(failed.status).toBe(503);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'service_unavailable', detail: 'PayOS service connection failed' },
    });
  });

  it('logs unexpected failures and returns a public 500 envelope', async () => {
    testConnectionMock.mockRejectedValueOnce(new Error('boom'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith({ error: expect.any(Error) }, 'PayOS test error');
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'PayOS test failed' },
    });
  });
});
