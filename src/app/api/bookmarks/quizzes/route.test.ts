import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getBookmarkQuizzesByUserMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getBookmarkQuizzesByUserMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/bookmark-factory', () => ({
  getBookmarkService: () => ({ getBookmarkQuizzesByUser: getBookmarkQuizzesByUserMock }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/bookmarks/quizzes/route';

const routeContext = { params: Promise.resolve({}) };

function request(): NextRequest {
  return new NextRequest('http://localhost/api/bookmarks/quizzes');
}

describe('GET /api/bookmarks/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
  });

  it('returns 401 when signed out and reads nothing', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(getBookmarkQuizzesByUserMock).not.toHaveBeenCalled();
  });

  it("returns the signed-in user's quizzes with bookmark counts and the total", async () => {
    const data = {
      quizzes: [
        { slug: 'algebra', title: 'Algebra', count: 3 },
        { slug: 'biology', title: 'Biology', count: 1 },
      ],
      total: 4,
    };
    getBookmarkQuizzesByUserMock.mockResolvedValue(data);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    expect(getBookmarkQuizzesByUserMock).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toMatchObject({ success: true, data });
  });

  it('returns an empty list when the user has no bookmarks', async () => {
    getBookmarkQuizzesByUserMock.mockResolvedValue({ quizzes: [], total: 0 });

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { quizzes: [], total: 0 },
    });
  });

  it('maps unexpected failures to a safe 500', async () => {
    getBookmarkQuizzesByUserMock.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch bookmarked quizzes' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error fetching bookmarked quizzes',
    );
  });
});
