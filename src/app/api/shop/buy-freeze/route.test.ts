import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, buyStreakFreezeMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  buyStreakFreezeMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/learning-progress-factory', () => ({
  getLearningProgressService: () => ({
    buyStreakFreeze: buyStreakFreezeMock,
  }),
}));

import { POST } from '@/app/api/shop/buy-freeze/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/shop/buy-freeze', { method: 'POST' });
}

describe('POST /api/shop/buy-freeze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request(), routeContext)).status).toBe(401);
    expect(buyStreakFreezeMock).not.toHaveBeenCalled();
  });

  it('purchases a streak freeze for the authenticated user', async () => {
    buyStreakFreezeMock.mockResolvedValue({
      success: true,
      data: { freezes: 2, cost: 100 },
    });

    const response = await POST(request(), routeContext);

    expect(buyStreakFreezeMock).toHaveBeenCalledWith('user-1');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { freezes: 2, cost: 100 },
      meta: { message: 'Streak freeze purchased' },
    });
  });

  it('maps validation failures to 400 and other service failures through apiServiceErr', async () => {
    buyStreakFreezeMock
      .mockResolvedValueOnce({
        success: false,
        error: 'Not enough coins',
        statusCode: 400,
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Shop unavailable',
        statusCode: 503,
      });

    const validation = await POST(request(), routeContext);
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toMatchObject({
      error: { code: 'validation_error', detail: 'Not enough coins' },
    });

    const upstream = await POST(request(), routeContext);
    expect(upstream.status).toBe(503);
    await expect(upstream.json()).resolves.toMatchObject({
      error: { detail: 'Shop unavailable' },
    });
  });
});
