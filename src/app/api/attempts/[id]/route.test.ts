import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getAttemptDetailsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getAttemptDetailsMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/serviceFactory', () => ({
  serviceFactory: {
    getUserService: () => ({
      getAttemptDetails: getAttemptDetailsMock,
    }),
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { GET } from './route';

const attemptId = '507f191e810c19729de860ea';
const detail = {
  id: attemptId,
  score: 80,
  correctAnswers: 4,
  totalQuestions: 5,
};

function request(url: string) {
  return new NextRequest(url);
}

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
      },
    });
    expect(getAttemptDetailsMock).not.toHaveBeenCalled();
  });

  it('loads guest attempt detail with validated userEmail', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(
      request(`http://localhost/api/attempts/${attemptId}?userEmail=Guest%40Example.com`),
      { params: Promise.resolve({ id: attemptId }) },
    );

    expect(response.status).toBe(200);
    expect(getAttemptDetailsMock).toHaveBeenCalledWith(attemptId, {
      guestEmail: 'Guest@Example.com',
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
    expect(getAttemptDetailsMock).toHaveBeenCalledWith(attemptId, { userId: 'user-1' });
  });
});
