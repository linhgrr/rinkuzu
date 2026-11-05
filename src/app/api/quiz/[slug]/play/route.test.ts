import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getQuizForPlayMock, getRetryQuizForPlayMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuizForPlayMock: vi.fn(),
  getRetryQuizForPlayMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/quiz-factory', () => ({
  getQuizService: () => ({
    getQuizForPlay: getQuizForPlayMock,
    getRetryQuizForPlay: getRetryQuizForPlayMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/quiz/[slug]/play/route';

const slug = 'algebra';
const attemptId = '507f191e810c19729de860ec';
const routeContext = { params: Promise.resolve({ slug }) };

function request(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/quiz/${slug}/play${query}`);
}

describe('GET /api/quiz/[slug]/play', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(null);
    getQuizForPlayMock.mockResolvedValue({ success: true, data: { slug } });
    getRetryQuizForPlayMock.mockResolvedValue({ success: true, data: { slug } });
  });

  it('serves the full quiz without retryOf', async () => {
    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    expect(getQuizForPlayMock).toHaveBeenCalledWith(slug, undefined, undefined);
    expect(getRetryQuizForPlayMock).not.toHaveBeenCalled();
  });

  it('serves the retry session for ?retryOf=<attemptId>', async () => {
    const response = await GET(request(`?retryOf=${attemptId}`), routeContext);

    expect(response.status).toBe(200);
    expect(getRetryQuizForPlayMock).toHaveBeenCalledWith(slug, attemptId, undefined, undefined);
    expect(getQuizForPlayMock).not.toHaveBeenCalled();
  });

  it('maps nothing_to_retry to a 409 with a stable code', async () => {
    getRetryQuizForPlayMock.mockResolvedValue({
      success: false,
      error: 'Nothing to retry',
      statusCode: 409,
      code: 'nothing_to_retry',
    });

    const response = await GET(request(`?retryOf=${attemptId}`), routeContext);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'nothing_to_retry' },
    });
  });

  it('rejects a malformed retryOf with 400 before calling the service', async () => {
    const response = await GET(request('?retryOf=not-an-id'), routeContext);

    expect(response.status).toBe(400);
    expect(getRetryQuizForPlayMock).not.toHaveBeenCalled();
    expect(getQuizForPlayMock).not.toHaveBeenCalled();
  });
});
