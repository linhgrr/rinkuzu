import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, listLibraryMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  listLibraryMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/learning-progress-factory', () => ({
  getLearningProgressService: () => ({ listLibrary: listLibraryMock }),
}));

import { GET } from '@/app/api/library/route';

const routeContext = { params: Promise.resolve({}) };
const counts = { all: 130, inProgress: 5, complete: 100 };

function get(query: string) {
  return GET(new NextRequest(`http://localhost/api/library${query}`), routeContext);
}

describe('GET /api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    listLibraryMock.mockResolvedValue({
      success: true,
      data: {
        quizzes: [],
        pagination: {
          currentPage: 2,
          totalPages: 3,
          totalItems: 60,
          itemsPerPage: 24,
          hasNextPage: true,
          hasPrevPage: true,
        },
        counts,
      },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await get('');

    expect(response.status).toBe(401);
    expect(listLibraryMock).not.toHaveBeenCalled();
  });

  it('passes status, trimmed q and page size to the service and returns counts', async () => {
    const response = await get('?status=complete&q=%20%25algebra%20&page=2&limit=24');

    expect(response.status).toBe(200);
    expect(listLibraryMock).toHaveBeenCalledWith('user-1', {
      folder: undefined,
      page: 2,
      limit: 24,
      status: 'complete',
      q: '%algebra',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { counts, pagination: { totalItems: 60, itemsPerPage: 24 } },
    });
  });

  it('keeps the default page size of 100 for callers that send no limit', async () => {
    await get('?folder=unfiled');

    expect(listLibraryMock).toHaveBeenCalledWith('user-1', {
      folder: null,
      page: 1,
      limit: 100,
    });
  });

  it.each([
    ['unknown status', '?status=not_started'],
    ['empty q', '?q='],
    ['blank q', '?q=%20%20'],
    ['q over 80 characters', `?q=${'a'.repeat(81)}`],
    ['unknown parameter', '?sort=title'],
  ])('rejects %s with 400', async (_label, query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(listLibraryMock).not.toHaveBeenCalled();
  });
});
