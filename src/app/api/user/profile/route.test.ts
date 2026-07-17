import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getProfileMock, updateProfileMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getProfileMock: vi.fn(),
  updateProfileMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/account-factory', () => ({
  getAccountService: () => ({
    getProfile: getProfileMock,
    updateProfile: updateProfileMock,
  }),
}));

import { GET, PUT, dynamic } from '@/app/api/user/profile/route';

function session(email = 'user@example.com') {
  return {
    user: { id: 'user-1', email, role: 'user' },
  };
}

const getRequest = new NextRequest('http://localhost/api/user/profile');
const routeContext = { params: Promise.resolve({}) };

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getProfileMock.mockResolvedValue({
      success: true,
      data: { email: 'user@example.com', displayName: 'User' },
    });
  });

  it('requires authentication and returns the profile payload', async () => {
    expect(dynamic).toBe('force-dynamic');

    authMock.mockResolvedValueOnce(null);
    expect((await GET(getRequest, routeContext)).status).toBe(401);
    expect(getProfileMock).not.toHaveBeenCalled();

    const response = await GET(getRequest, routeContext);
    expect(getProfileMock).toHaveBeenCalledWith('user@example.com');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { email: 'user@example.com' },
    });
  });

  it('maps profile service failures', async () => {
    getProfileMock.mockResolvedValueOnce({
      success: false,
      code: 'not_found',
      error: 'Profile not found',
      statusCode: 404,
    });

    const response = await GET(getRequest, routeContext);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found' },
    });
  });
});

describe('PUT /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    updateProfileMock.mockResolvedValue({
      success: true,
      data: { email: 'user@example.com', displayName: 'Updated', bio: 'Hello' },
    });
  });

  it('validates the body and updates only provided fields', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await PUT(putRequest({ displayName: 'X' }), routeContext)).status).toBe(401);

    const invalid = await PUT(putRequest({ displayName: 'x'.repeat(51) }), routeContext);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(updateProfileMock).not.toHaveBeenCalled();

    const tooLongBio = await PUT(putRequest({ bio: 'b'.repeat(161) }), routeContext);
    expect(tooLongBio.status).toBe(400);
    expect(updateProfileMock).not.toHaveBeenCalled();

    const response = await PUT(putRequest({ displayName: 'Updated', bio: 'Hello' }), routeContext);
    expect(updateProfileMock).toHaveBeenCalledWith('user@example.com', {
      displayName: 'Updated',
      bio: 'Hello',
    });
    expect(response.status).toBe(200);

    await PUT(putRequest({ displayName: 'Only name' }), routeContext);
    expect(updateProfileMock).toHaveBeenLastCalledWith('user@example.com', {
      displayName: 'Only name',
    });
    expect(updateProfileMock.mock.calls.at(-1)?.[1]).not.toHaveProperty('bio');

    await PUT(putRequest({ bio: 'Only bio' }), routeContext);
    expect(updateProfileMock).toHaveBeenLastCalledWith('user@example.com', {
      bio: 'Only bio',
    });
    expect(updateProfileMock.mock.calls.at(-1)?.[1]).not.toHaveProperty('displayName');

    await PUT(putRequest({}), routeContext);
    expect(updateProfileMock).toHaveBeenLastCalledWith('user@example.com', {});
  });

  it('maps update service failures', async () => {
    updateProfileMock.mockResolvedValueOnce({
      success: false,
      code: 'validation_error',
      error: 'Invalid profile',
      statusCode: 400,
    });

    const response = await PUT(putRequest({ displayName: 'Ok' }), routeContext);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
  });
});
