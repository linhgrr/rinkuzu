import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listDueReviewsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listDueReviewsMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/learning-progress-factory', () => ({
  getLearningProgressService: () => ({
    listDueReviews: listDueReviewsMock,
  }),
}));

import { GET, dynamic } from '@/app/api/review/due/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

describe('GET /api/review/due', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    listDueReviewsMock.mockResolvedValue({
      success: true,
      data: {
        questions: [
          {
            id: 'qp-1',
            userId: 'user-1',
            quizSlug: 'algebra',
            questionId: 'q-1',
            srsLevel: 1,
          },
        ],
        count: 1,
      },
    });
  });

  it('is force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/review/due'), routeContext);

    expect(response.status).toBe(401);
    expect(listDueReviewsMock).not.toHaveBeenCalled();
  });

  it('returns due reviews for the authenticated user', async () => {
    const response = await GET(new NextRequest('http://localhost/api/review/due'), routeContext);

    expect(response.status).toBe(200);
    expect(listDueReviewsMock).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        questions: [{ id: 'qp-1', quizSlug: 'algebra', questionId: 'q-1' }],
        count: 1,
      },
    });
  });

  it('maps service failures through the shared error envelope', async () => {
    listDueReviewsMock.mockResolvedValueOnce({
      success: false,
      error: 'Unable to load reviews',
      statusCode: 500,
      code: 'internal_error',
    });

    const response = await GET(new NextRequest('http://localhost/api/review/due'), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Unable to load reviews' },
    });
  });
});
