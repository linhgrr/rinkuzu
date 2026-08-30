import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { withCommunicationRead } from '@/lib/api/communication-read';
import { CommunicationError } from '@/lib/communication/internal';

const RECORD_ID = '507f191e810c19729de860ed';

function adminSession(role = 'admin') {
  return { user: { id: 'admin-1', email: 'ops@example.test', role } };
}

function getRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/feedback/x', { method: 'GET' });
}

describe('withCommunicationRead', () => {
  const load = vi.fn();
  const route = withCommunicationRead('admin-feedback-detail', load);
  const context = { params: Promise.resolve({ id: RECORD_ID }) };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(adminSession());
    load.mockResolvedValue({ id: RECORD_ID, status: 'open' });
  });

  it('loads the record named by the route', async () => {
    const response = await route(getRequest(), context);

    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledWith(RECORD_ID);
  });

  it('is closed to a signed-in non-admin', async () => {
    authMock.mockResolvedValue(adminSession('user'));

    const response = await route(getRequest(), context);

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(load).not.toHaveBeenCalled();
  });

  it('refuses a malformed id instead of asking the domain about it', async () => {
    const response = await route(getRequest(), { params: Promise.resolve({ id: 'not-an-id' }) });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.meta.fields).toHaveProperty('id');
    expect(load).not.toHaveBeenCalled();
  });

  it('passes a domain refusal through with the status it earned, not a flat 500', async () => {
    load.mockRejectedValue(new CommunicationError('not_found', 'No such record', 404));

    const response = await route(getRequest(), context);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });
});
