import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, assignQuizMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  assignQuizMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/folder-factory', () => ({
  getFolderService: () => ({
    assignQuiz: assignQuizMock,
  }),
}));

import { POST } from '@/app/api/folders/[id]/quizzes/route';

const folderId = '507f1f77bcf86cd799439011';
const quizId = '507f1f77bcf86cd799439012';
const ownerId = '507f191e810c19729de860ea';

function session() {
  return {
    user: { id: ownerId, email: 'owner@example.com', role: 'user' },
  };
}

function request(body: unknown, id = folderId) {
  return new NextRequest(`http://localhost/api/folders/${id}/quizzes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/folders/[id]/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    assignQuizMock.mockResolvedValue({
      success: true,
      data: { quizId, folderId, assigned: true },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(request({ quizId }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(401);
    expect(assignQuizMock).not.toHaveBeenCalled();
  });

  it('rejects invalid quiz ids before assignment', async () => {
    const response = await POST(request({ quizId: 'not-valid' }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta.fields).toEqual(
      expect.objectContaining({
        quizId: expect.any(String),
      }),
    );
    expect(assignQuizMock).not.toHaveBeenCalled();
  });

  it('rejects invalid folder target ids with field-level meta', async () => {
    const response = await POST(request({ quizId }, 'bad-folder'), {
      params: Promise.resolve({ id: 'bad-folder' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta.fields).toEqual(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
    expect(assignQuizMock).not.toHaveBeenCalled();
  });

  it('assigns a quiz into the owned folder and returns the assignment DTO', async () => {
    const response = await POST(request({ quizId }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(200);
    expect(assignQuizMock).toHaveBeenCalledWith(folderId, quizId, ownerId);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { quizId, folderId, assigned: true },
      meta: { message: 'Quiz added to folder' },
    });
  });

  it('supports the unfiled folder target sentinel', async () => {
    assignQuizMock.mockResolvedValueOnce({
      success: true,
      data: { quizId, folderId: null, assigned: true },
    });

    const response = await POST(request({ quizId }, 'unfiled'), {
      params: Promise.resolve({ id: 'unfiled' }),
    });

    expect(response.status).toBe(200);
    expect(assignQuizMock).toHaveBeenCalledWith(null, quizId, ownerId);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { quizId, folderId: null, assigned: true },
    });
  });

  it('maps assignment service failures through the shared error envelope', async () => {
    assignQuizMock.mockResolvedValueOnce({
      success: false,
      error: 'Folder not found',
      statusCode: 404,
      code: 'not_found',
    });

    const response = await POST(request({ quizId }), {
      params: Promise.resolve({ id: folderId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'not_found', detail: 'Folder not found' },
    });
  });
});
