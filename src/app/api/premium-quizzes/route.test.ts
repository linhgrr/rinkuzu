import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listCatalogMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listCatalogMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));

vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({ listCatalog: listCatalogMock }),
}));

import { NextRequest } from 'next/server';
import { GET as getCatalog } from '@/app/api/premium-quizzes/route';

function GET(request: Request) {
  return getCatalog(new NextRequest(request), { params: Promise.resolve({}) });
}

describe('GET /api/premium-quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    listCatalogMock.mockResolvedValue({
      items: [
        {
          quizId: '507f191e810c19729de860ea',
          title: 'Curated algebra',
          slug: 'curated-algebra',
          questionCount: 20,
        },
      ],
      page: 2,
      limit: 6,
      totalItems: 7,
      totalPages: 2,
    });
  });

  it('returns catalog metadata with private no-store and anti-index headers', async () => {
    const response = await GET(
      new Request('http://localhost/api/premium-quizzes?page=2&limit=6&search=algebra'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(listCatalogMock).toHaveBeenCalledWith({ page: 2, limit: 6, search: 'algebra' }, null);
    expect(payload.data.items[0]).toEqual({
      quizId: '507f191e810c19729de860ea',
      title: 'Curated algebra',
      slug: 'curated-algebra',
      questionCount: 20,
    });
    expect(payload.data.items[0]).not.toHaveProperty('questions');
  });

  it('passes the signed-in learner so owned cards come back unlocked (RIN-1014)', async () => {
    authMock.mockResolvedValue({ user: { id: '507f191e810c19729de860ee', role: 'user' } });

    await GET(new Request('http://localhost/api/premium-quizzes?page=1&limit=12'));

    expect(listCatalogMock).toHaveBeenCalledWith(
      { page: 1, limit: 12 },
      '507f191e810c19729de860ee',
    );
  });

  it('rejects unknown or out-of-range query parameters before calling the service', async () => {
    const response = await GET(
      new Request('http://localhost/api/premium-quizzes?page=0&unknown=true'),
    );

    expect(response.status).toBe(400);
    expect(listCatalogMock).not.toHaveBeenCalled();
  });
});
