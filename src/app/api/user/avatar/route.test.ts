import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_MAX_FILE_SIZE } from '@/shared/constants/avatar';

const { authMock, uploadAvatarMock, deleteAvatarMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadAvatarMock: vi.fn(),
  deleteAvatarMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/account-factory', () => ({
  getAccountService: () => ({
    uploadAvatar: uploadAvatarMock,
    deleteAvatar: deleteAvatarMock,
  }),
}));

import { DELETE, PUT } from '@/app/api/user/avatar/route';

function session(email = 'user@example.com') {
  return {
    user: { id: 'user-1', email, role: 'user' },
  };
}

function putRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost/api/user/avatar', {
    method: 'PUT',
    body: formData,
  });
}

const deleteRequest = new NextRequest('http://localhost/api/user/avatar', {
  method: 'DELETE',
});
const routeContext = { params: Promise.resolve({}) };

describe('PUT /api/user/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    uploadAvatarMock.mockResolvedValue({
      success: true,
      data: { url: 'https://cdn.example/avatar.png' },
    });
  });

  it('requires authentication and a valid avatar image', async () => {
    authMock.mockResolvedValueOnce(null);
    const unauthorized = await PUT(putRequest(new FormData()), routeContext);
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    });

    const missing = new FormData();
    missing.set('avatar', 'nope');
    const missingResponse = await PUT(putRequest(missing), routeContext);
    expect(missingResponse.status).toBe(400);
    await expect(missingResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'validation_error',
        detail: 'No file provided',
      },
    });

    const badType = new FormData();
    badType.set('avatar', new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' }));
    const badTypeResponse = await PUT(putRequest(badType), routeContext);
    expect(badTypeResponse.status).toBe(400);
    await expect(badTypeResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'validation_error',
        detail: 'Only JPG, PNG, and WebP images are allowed',
      },
    });

    const atLimit = new FormData();
    atLimit.set(
      'avatar',
      new File([new Uint8Array(AVATAR_MAX_FILE_SIZE)], 'ok.png', {
        type: 'image/png',
      }),
    );
    expect((await PUT(putRequest(atLimit), routeContext)).status).toBe(200);
    expect(uploadAvatarMock).toHaveBeenCalledOnce();

    const oversized = new FormData();
    oversized.set(
      'avatar',
      new File([new Uint8Array(AVATAR_MAX_FILE_SIZE + 1)], 'big.png', {
        type: 'image/png',
      }),
    );
    const oversizedResponse = await PUT(putRequest(oversized), routeContext);
    expect(oversizedResponse.status).toBe(400);
    await expect(oversizedResponse.json()).resolves.toMatchObject({
      success: false,
      error: {
        code: 'validation_error',
        detail: 'File size must be less than 2MB',
      },
    });
    expect(uploadAvatarMock).toHaveBeenCalledOnce();
  });

  it('uploads allowed avatar types and maps service responses', async () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      uploadAvatarMock.mockClear();
      const formData = new FormData();
      formData.set('avatar', new File([new Uint8Array([1, 2, 3])], `me.${type}`, { type }));

      const response = await PUT(putRequest(formData), routeContext);

      expect(response.status).toBe(200);
      expect(uploadAvatarMock).toHaveBeenCalledWith('user@example.com', {
        bytes: expect.any(Uint8Array),
        contentType: type,
      });
    }

    const formData = new FormData();
    formData.set(
      'avatar',
      new File([new Uint8Array([1, 2, 3])], 'me.webp', { type: 'image/webp' }),
    );
    uploadAvatarMock.mockResolvedValueOnce({
      success: false,
      error: 'Image upload not configured',
      statusCode: 500,
    });
    const failed = await PUT(putRequest(formData), routeContext);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'configuration_error' },
    });
  });
});

describe('DELETE /api/user/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    deleteAvatarMock.mockResolvedValue({ success: true, data: { removed: true } });
  });

  it('requires authentication and returns the removal envelope', async () => {
    authMock.mockResolvedValueOnce(null);
    const unauthorized = await DELETE(deleteRequest, routeContext);
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toMatchObject({
      error: { code: 'unauthorized' },
    });

    const response = await DELETE(deleteRequest, routeContext);
    expect(deleteAvatarMock).toHaveBeenCalledWith('user@example.com');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { removed: true },
      meta: { message: 'Avatar removed' },
    });
  });

  it('maps service delete failures', async () => {
    deleteAvatarMock.mockResolvedValueOnce({
      success: false,
      code: 'not_found',
      error: 'Avatar not found',
      statusCode: 404,
    });

    const response = await DELETE(deleteRequest, routeContext);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found' },
    });
  });
});
