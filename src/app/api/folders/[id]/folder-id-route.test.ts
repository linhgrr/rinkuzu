import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));

import { createFolderIdRoute } from '@/app/api/folders/[id]/folder-id-route';

const request = new NextRequest('http://localhost/api/folders/507f1f77bcf86cd799439011');
const routeContext = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }) };

describe('createFolderIdRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
  });

  it('rejects an invalid folder id before invoking the route handler', async () => {
    const handle = vi.fn();
    const route = createFolderIdRoute({ handle });

    const response = await route(request, { params: Promise.resolve({ id: 'invalid' }) });

    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });

  it('passes the request, validated folder id, and authenticated user id', async () => {
    const handle = vi.fn().mockResolvedValue(new Response('ok'));
    const route = createFolderIdRoute({ handle });

    await route(request, routeContext);

    expect(handle).toHaveBeenCalledWith({
      request,
      folderId: '507f1f77bcf86cd799439011',
      userId: 'user-1',
    });
  });
});
