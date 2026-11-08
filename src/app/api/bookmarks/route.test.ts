import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getBookmarksByUserMock, createBookmarkMock, loggerErrorMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    getBookmarksByUserMock: vi.fn(),
    createBookmarkMock: vi.fn(),
    loggerErrorMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/bookmark-factory', () => ({
  getBookmarkService: () => ({
    getBookmarksByUser: getBookmarksByUserMock,
    createBookmark: createBookmarkMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET, POST } from '@/app/api/bookmarks/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return {
    user: { id: 'user-1', email: 'user@example.com', role: 'user' },
  };
}

function request(
  url = 'http://localhost/api/bookmarks',
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(url, init);
}

const validCreateBody = {
  quiz: { slug: 'algebra', title: 'Algebra', description: 'Basics' },
  question: {
    text: 'What is 2+2?',
    options: ['3', '4'],
    type: 'single' as const,
    correctIndex: 1,
  },
  questionIndex: 0,
};

const bookmarkDto = {
  id: '507f191e810c19729de860ea',
  quiz: { slug: 'algebra', title: 'Algebra' },
  question: validCreateBody.question,
  questionIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('GET /api/bookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getBookmarksByUserMock.mockResolvedValue({
      bookmarks: [bookmarkDto],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(401);
    expect(getBookmarksByUserMock).not.toHaveBeenCalled();
  });

  it('rejects invalid list query params with field-level validation meta', async () => {
    const response = await GET(
      request('http://localhost/api/bookmarks?page=0&limit=999'),
      routeContext,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: 'validation_error' },
    });
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        page: expect.any(String),
      }),
    );
    expect(Object.keys(body.error.meta?.fields ?? {})).not.toHaveLength(0);
    expect(getBookmarksByUserMock).not.toHaveBeenCalled();
  });

  it('returns bookmarks and pagination for the authenticated user with validated filters', async () => {
    const response = await GET(
      request('http://localhost/api/bookmarks?page=2&limit=5&quizSlug=algebra'),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(getBookmarksByUserMock).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 5,
      quizSlug: 'algebra',
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        bookmarks: [bookmarkDto],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
  });

  it('returns an empty list with totalItems 0, not 404, for a quiz slug with no bookmarks', async () => {
    const emptyPagination = {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      itemsPerPage: 10,
      hasNextPage: false,
      hasPrevPage: false,
    };
    getBookmarksByUserMock.mockResolvedValueOnce({ bookmarks: [], pagination: emptyPagination });

    const response = await GET(
      request('http://localhost/api/bookmarks?quizSlug=never-bookmarked'),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { bookmarks: [], pagination: { totalItems: 0 } },
    });
  });

  it('scopes a quiz slug filter to the session user, never a user id from the query', async () => {
    await GET(
      request('http://localhost/api/bookmarks?quizSlug=algebra&userId=user-2'),
      routeContext,
    );

    expect(getBookmarksByUserMock).toHaveBeenCalledOnce();
    expect(getBookmarksByUserMock).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 10,
      quizSlug: 'algebra',
    });
  });

  it('maps unexpected fetch failures to a safe 500 without leaking internals', async () => {
    getBookmarksByUserMock.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to fetch bookmarks' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error fetching bookmarks',
    );
  });
});

describe('POST /api/bookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    createBookmarkMock.mockResolvedValue(bookmarkDto);
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      }),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(createBookmarkMock).not.toHaveBeenCalled();
  });

  it('rejects invalid create payloads with field meta', async () => {
    const response = await POST(
      request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quiz: { slug: '' }, question: {}, questionIndex: -1 }),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.fields).toEqual(expect.any(Object));
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(createBookmarkMock).not.toHaveBeenCalled();
  });

  it('creates a bookmark for the authenticated user identity', async () => {
    const response = await POST(
      request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(createBookmarkMock).toHaveBeenCalledWith(
      { userId: 'user-1', userEmail: 'user@example.com' },
      validCreateBody,
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: bookmarkDto,
    });
  });

  it('maps duplicate bookmark conflicts to 400 validation_error', async () => {
    createBookmarkMock.mockRejectedValueOnce(new Error('Question already bookmarked'));

    const response = await POST(
      request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Question already bookmarked' },
    });
  });

  it('maps unknown create failures to 500', async () => {
    createBookmarkMock.mockRejectedValueOnce(new Error('write failed'));

    const response = await POST(
      request('http://localhost/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validCreateBody),
      }),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Failed to create bookmark' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error creating bookmark',
    );
  });
});
