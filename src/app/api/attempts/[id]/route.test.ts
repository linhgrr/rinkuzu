import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getAttemptDetailsMock, loggerErrorMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getAttemptDetailsMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/user-factory', () => ({
  getUserService: () => ({
    getAttemptDetails: getAttemptDetailsMock,
  }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from './route';

const attemptId = '507f191e810c19729de860ea';
const detail = {
  id: attemptId,
  score: 80,
  correctAnswers: 4,
  totalQuestions: 5,
};

function request(url: string, headers?: Record<string, string>) {
  return new NextRequest(url, headers === undefined ? undefined : { headers });
}

const claimToken = 'A'.repeat(42) + '_';

describe('GET /api/attempts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAttemptDetailsMock.mockResolvedValue({ success: true, data: detail });
  });

  it('returns 401 when neither session nor userEmail is provided', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(`http://localhost/api/attempts/${attemptId}`), {
      params: Promise.resolve({ id: attemptId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'unauthorized',
        detail: 'Authentication required or userEmail parameter',
      },
    });
    expect(getAttemptDetailsMock).not.toHaveBeenCalled();
  });

  it('rejects invalid attempt ids before ownership resolution', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request('http://localhost/api/attempts/not-an-object-id'), {
      params: Promise.resolve({ id: 'not-an-object-id' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'validation_error' },
    });
    // pins non-empty fields meta (kills ObjectLiteral -> {} on param validation)
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(getAttemptDetailsMock).not.toHaveBeenCalled();
  });

  it('rejects invalid userEmail query values', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      request(`http://localhost/api/attempts/${attemptId}?userEmail=not-an-email`),
      { params: Promise.resolve({ id: attemptId }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'validation_error' },
    });
    // pins non-empty fields meta (kills ObjectLiteral -> {} on query validation)
    expect(body.error.meta?.fields).toEqual(
      expect.objectContaining({
        userEmail: expect.any(String),
      }),
    );
    expect(Object.keys(body.error.meta?.fields ?? {}).length).toBeGreaterThan(0);
    expect(getAttemptDetailsMock).not.toHaveBeenCalled();
  });

  it('loads guest attempt detail with validated userEmail', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      request(`http://localhost/api/attempts/${attemptId}?userEmail=Guest%40Example.com`),
      { params: Promise.resolve({ id: attemptId }) },
    );

    expect(response.status).toBe(200);
    expect(getAttemptDetailsMock).toHaveBeenCalledWith(
      attemptId,
      { guestEmail: 'Guest@Example.com' },
      {},
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: detail,
    });
  });

  it('uses the authenticated user id without requiring userEmail', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    const response = await GET(request(`http://localhost/api/attempts/${attemptId}`), {
      params: Promise.resolve({ id: attemptId }),
    });

    expect(response.status).toBe(200);
    expect(getAttemptDetailsMock).toHaveBeenCalledWith(attemptId, { userId: 'user-1' }, {});
  });

  it('passes the learner locale through for the next-quiz pick', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });

    const response = await GET(request(`http://localhost/api/attempts/${attemptId}?locale=vi`), {
      params: Promise.resolve({ id: attemptId }),
    });

    expect(response.status).toBe(200);
    expect(getAttemptDetailsMock).toHaveBeenCalledWith(
      attemptId,
      { userId: 'user-1' },
      { locale: 'vi' },
    );
  });

  it('maps ownership and not-found service failures', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    getAttemptDetailsMock.mockResolvedValueOnce({
      success: false,
      code: 'forbidden',
      error: 'Not allowed to view this attempt',
      statusCode: 403,
    });

    const response = await GET(request(`http://localhost/api/attempts/${attemptId}`), {
      params: Promise.resolve({ id: attemptId }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'forbidden', detail: 'Not allowed to view this attempt' },
    });
  });

  it('maps unexpected exceptions to a safe 500', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    getAttemptDetailsMock.mockRejectedValueOnce(new Error('db fail'));

    const response = await GET(request(`http://localhost/api/attempts/${attemptId}`), {
      params: Promise.resolve({ id: attemptId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'internal_error', detail: 'Internal server error' },
    });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Get attempt details error',
    );
  });

  describe('guest claim token (RIN-912)', () => {
    const context = { params: Promise.resolve({ id: attemptId }) };

    it('reads the attempt with the x-guest-claim-token header', async () => {
      authMock.mockResolvedValue(null);

      const response = await GET(
        request(`http://localhost/api/attempts/${attemptId}`, {
          'x-guest-claim-token': claimToken,
        }),
        context,
      );

      expect(response.status).toBe(200);
      expect(getAttemptDetailsMock).toHaveBeenCalledWith(
        attemptId,
        { guestClaimToken: claimToken },
        {},
      );
    });

    it('returns the service miss for a well-formed but wrong token', async () => {
      authMock.mockResolvedValue(null);
      getAttemptDetailsMock.mockResolvedValue({
        success: false,
        error: 'Attempt not found',
        statusCode: 404,
      });

      const response = await GET(
        request(`http://localhost/api/attempts/${attemptId}`, {
          'x-guest-claim-token': 'B'.repeat(43),
        }),
        context,
      );

      expect(response.status).toBe(404);
    });

    it('rejects a malformed token without calling the service', async () => {
      authMock.mockResolvedValue(null);

      const response = await GET(
        request(`http://localhost/api/attempts/${attemptId}`, {
          'x-guest-claim-token': 'short',
        }),
        context,
      );

      expect(response.status).toBe(400);
      expect(getAttemptDetailsMock).not.toHaveBeenCalled();
    });

    it('prefers the session owner and ignores the header when signed in', async () => {
      authMock.mockResolvedValue({ user: { id: '507f191e810c19729de860eb', role: 'user' } });

      const response = await GET(
        request(`http://localhost/api/attempts/${attemptId}`, {
          'x-guest-claim-token': 'short',
        }),
        context,
      );

      expect(response.status).toBe(200);
      expect(getAttemptDetailsMock).toHaveBeenCalledWith(
        attemptId,
        { userId: '507f191e810c19729de860eb' },
        {},
      );
    });
  });
});
