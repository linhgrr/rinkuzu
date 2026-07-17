import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listFoldersMock, createFolderMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listFoldersMock: vi.fn(),
  createFolderMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/folder-factory', () => ({
  getFolderService: () => ({
    listFolders: listFoldersMock,
    createFolder: createFolderMock,
  }),
}));

import { GET, POST } from '@/app/api/folders/route';

const routeContext = { params: Promise.resolve({}) };
const ownerId = '507f191e810c19729de860ea';
const folderId = '507f1f77bcf86cd799439011';

function session() {
  return {
    user: { id: ownerId, email: 'owner@example.com', role: 'user' },
  };
}

function request(
  url = 'http://localhost/api/folders',
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(url, init);
}

describe('GET /api/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    listFoldersMock.mockResolvedValue({
      success: true,
      data: {
        folders: [
          {
            id: folderId,
            name: 'Algorithms',
            quizCount: 2,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        unfiledCount: 3,
      },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(listFoldersMock).not.toHaveBeenCalled();
  });

  it('lists folders for the authenticated owner', async () => {
    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    expect(listFoldersMock).toHaveBeenCalledWith(ownerId);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        folders: [{ id: folderId, name: 'Algorithms', quizCount: 2 }],
        unfiledCount: 3,
      },
    });
  });

  it('maps service failures through the shared error envelope', async () => {
    listFoldersMock.mockResolvedValueOnce({
      success: false,
      error: 'Failed to load folders',
      statusCode: 500,
      code: 'internal_error',
    });

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to load folders' },
    });
  });
});

describe('POST /api/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    createFolderMock.mockResolvedValue({
      success: true,
      data: {
        id: folderId,
        name: 'Algorithms',
        quizCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      request('http://localhost/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Algorithms' }),
      }),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(createFolderMock).not.toHaveBeenCalled();
  });

  it('rejects empty folder names with validation_error', async () => {
    const response = await POST(
      request('http://localhost/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    // route passes Zod field map directly as meta (not nested under meta.fields)
    expect(body.error.meta).toEqual(
      expect.objectContaining({
        name: expect.any(String),
      }),
    );
    expect(createFolderMock).not.toHaveBeenCalled();
  });

  it('creates a folder for the authenticated owner and returns 201', async () => {
    const response = await POST(
      request('http://localhost/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '  Algorithms  ' }),
      }),
      routeContext,
    );

    expect(response.status).toBe(201);
    expect(createFolderMock).toHaveBeenCalledWith(ownerId, 'Algorithms');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: folderId, name: 'Algorithms' },
    });
  });

  it('maps name conflicts to 409 validation_error and other failures via apiServiceErr', async () => {
    createFolderMock.mockResolvedValueOnce({
      success: false,
      error: 'Folder name already exists',
      statusCode: 409,
    });
    const conflict = await POST(
      request('http://localhost/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Algorithms' }),
      }),
      routeContext,
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Folder name already exists' },
    });

    createFolderMock.mockResolvedValueOnce({
      success: false,
      error: 'Failed to create folder',
      statusCode: 500,
      code: 'internal_error',
    });
    const failed = await POST(
      request('http://localhost/api/folders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Algorithms' }),
      }),
      routeContext,
    );
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to create folder' },
    });
  });
});
