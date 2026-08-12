import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/auth', () => ({ auth: authMock }));

import { GET, POST } from './route';

const routeContext = { params: Promise.resolve({}) };
const adminSession = { user: { id: 'admin-1', email: 'admin@example.test', role: 'admin' } };

function request(method = 'GET') {
  return new NextRequest('http://localhost/api/admin/postiz?operation=capabilities', { method });
}

describe('/api/admin/postiz authentication and constraints', () => {
  beforeEach(() => {
    authMock.mockResolvedValue(adminSession);
    process.env['POSTIZ_PUBLIC_API_URL'] = 'https://social.example.test/public/v1';
    process.env['POSTIZ_API_KEY'] = 'server-only-test-key';
    process.env['POSTIZ_OWNED_INTEGRATION_IDS'] =
      'cmrxbd9bg0004li8fyg626pi7,cmrx2wuru0001ne81kz37lcys';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env['POSTIZ_PUBLIC_API_URL'];
    delete process.env['POSTIZ_API_KEY'];
    delete process.env['POSTIZ_OWNED_INTEGRATION_IDS'];
  });

  it('requires an authenticated admin session', async () => {
    authMock.mockResolvedValue(null);
    expect((await GET(request(), routeContext)).status).toBe(401);

    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.test', role: 'user' },
    });
    expect((await GET(request(), routeContext)).status).toBe(403);
  });

  it('returns the explicit provider capability matrix without exposing credentials', async () => {
    const response = await GET(request(), routeContext);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.threads.comments.supported).toBe(false);
    expect(body.data.telegram.singleReply.reason).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain('server-only-test-key');
  });

  it('fails closed for every reply write', async () => {
    const response = await POST(request('POST'), routeContext);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'POSTIZ_CAPABILITY_UNSUPPORTED' },
    });
  });
});
