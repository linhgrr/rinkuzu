import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, deleteBookmarkByUserMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  deleteBookmarkByUserMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getBookmarkService: () => ({
      deleteBookmarkByUser: deleteBookmarkByUserMock,
    }),
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { DELETE } from '@/app/api/bookmarks/[id]/route';

const bookmarkId = '507f191e810c19729de860ea';

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function request(id = bookmarkId) {
  return new NextRequest(`http://localhost/api/bookmarks/${id}`, { method: 'DELETE' });
}

describe('DELETE /api/bookmarks/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    deleteBookmarkByUserMock.mockResolvedValue({ deleted: true });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(request(), { params: Promise.resolve({ id: bookmarkId }) });

    expect(response.status).toBe(401);
    expect(deleteBookmarkByUserMock).not.toHaveBeenCalled();
  });

  it('rejects invalid bookmark ids before ownership deletion', async () => {
    const response = await DELETE(request('not-an-object-id'), {
      params: Promise.resolve({ id: 'not-an-object-id' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
    expect(deleteBookmarkByUserMock).not.toHaveBeenCalled();
  });

  it('deletes the bookmark for the authenticated owner and returns the service payload', async () => {
    const response = await DELETE(request(), { params: Promise.resolve({ id: bookmarkId }) });

    expect(response.status).toBe(200);
    expect(deleteBookmarkByUserMock).toHaveBeenCalledWith(bookmarkId, 'user-1');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true },
      meta: { message: 'Bookmark removed' },
    });
  });

  it('maps missing or unauthorized bookmarks to 404 with the ownership message', async () => {
    deleteBookmarkByUserMock.mockRejectedValueOnce(new Error('Bookmark not found or unauthorized'));

    const response = await DELETE(request(), { params: Promise.resolve({ id: bookmarkId }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'not_found',
        detail: 'Bookmark not found or unauthorized',
      },
    });
  });

  it('does not map other Error messages to 404', async () => {
    deleteBookmarkByUserMock.mockRejectedValueOnce(new Error('write concern failed'));

    const response = await DELETE(request(), { params: Promise.resolve({ id: bookmarkId }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to remove bookmark' },
    });
  });

  it('maps non-Error throws to a safe 500 and logs the failure', async () => {
    deleteBookmarkByUserMock.mockRejectedValueOnce('boom');

    const response = await DELETE(request(), { params: Promise.resolve({ id: bookmarkId }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to remove bookmark' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'boom' }),
      'Error removing bookmark',
    );
  });
});
