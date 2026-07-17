import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, renameFolderMock, deleteFolderMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  renameFolderMock: vi.fn(),
  deleteFolderMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/folder-factory', () => ({
  getFolderService: () => ({
    renameFolder: renameFolderMock,
    deleteFolder: deleteFolderMock,
  }),
}));

import { PATCH, DELETE } from '@/app/api/folders/[id]/route';

const folderId = '507f1f77bcf86cd799439011';
const ownerId = '507f191e810c19729de860ea';

function session() {
  return {
    user: { id: ownerId, email: 'owner@example.com', role: 'user' },
  };
}

function patchRequest(body: unknown, id = folderId) {
  return new NextRequest(`http://localhost/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id = folderId) {
  return new NextRequest(`http://localhost/api/folders/${id}`, { method: 'DELETE' });
}

describe('PATCH /api/folders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    renameFolderMock.mockResolvedValue({
      success: true,
      data: {
        id: folderId,
        name: 'Renamed',
        quizCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ name: 'Renamed' }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(401);
    expect(renameFolderMock).not.toHaveBeenCalled();
  });

  it('rejects invalid folder ids before rename', async () => {
    const response = await PATCH(patchRequest({ name: 'Renamed' }, 'bad-id'), {
      params: Promise.resolve({ id: 'bad-id' }),
    });

    expect(response.status).toBe(400);
    expect(renameFolderMock).not.toHaveBeenCalled();
  });

  it('rejects empty rename payloads', async () => {
    const response = await PATCH(patchRequest({ name: '' }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(renameFolderMock).not.toHaveBeenCalled();
  });

  it('renames the owned folder and returns the updated summary', async () => {
    const response = await PATCH(patchRequest({ name: '  Renamed  ' }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(200);
    expect(renameFolderMock).toHaveBeenCalledWith(folderId, ownerId, 'Renamed');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: folderId, name: 'Renamed' },
    });
  });

  it('maps rename name conflicts to 409 and other failures via service error mapping', async () => {
    renameFolderMock.mockResolvedValueOnce({
      success: false,
      error: 'Folder name already exists',
      statusCode: 409,
    });
    const conflict = await PATCH(patchRequest({ name: 'Taken' }), {
      params: Promise.resolve({ id: folderId }),
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Folder name already exists' },
    });

    renameFolderMock.mockResolvedValueOnce({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
      code: 'not_found',
    });
    const missing = await PATCH(patchRequest({ name: 'Missing' }), {
      params: Promise.resolve({ id: folderId }),
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Folder not found' },
    });
  });
});

describe('DELETE /api/folders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    deleteFolderMock.mockResolvedValue({
      success: true,
      data: { deleted: true },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(401);
    expect(deleteFolderMock).not.toHaveBeenCalled();
  });

  it('deletes the owned folder and returns the confirmation meta message', async () => {
    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(200);
    expect(deleteFolderMock).toHaveBeenCalledWith(folderId, ownerId);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { deleted: true },
      meta: { message: 'Folder deleted' },
    });
  });

  it('maps delete service failures without inventing success', async () => {
    deleteFolderMock.mockResolvedValueOnce({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
      code: 'not_found',
    });

    const response = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Folder not found' },
    });
  });
});
