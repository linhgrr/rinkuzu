import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('api client helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchApiResponse preserves the success envelope and top-level extras', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ _id: 'plan-1', name: 'Pro' }],
          message: 'ok',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      fetchApiResponse<Array<{ _id: string; name: string }>, { message: string }>(
        '/api/admin/plans',
      ),
    ).resolves.toEqual({
      success: true,
      data: [{ _id: 'plan-1', name: 'Pro' }],
      message: 'ok',
    });
  });

  it('fetchApiData unwraps the nested data payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            quizzes: [{ _id: 'quiz-1', title: 'Linear Algebra Basics' }],
            pagination: { page: 1, totalPages: 1 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      fetchApiData<{
        quizzes: Array<{ _id: string; title: string }>;
        pagination: { page: number; totalPages: number };
      }>('/api/quizzes?page=1'),
    ).resolves.toEqual({
      quizzes: [{ _id: 'quiz-1', title: 'Linear Algebra Basics' }],
      pagination: { page: 1, totalPages: 1 },
    });
  });

  it('treats 204 responses as success with null data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      fetchApiData<null>('/api/bookmarks/abc', { method: 'DELETE' }),
    ).resolves.toBeNull();
  });

  it('throws ApiResponseError when the API returns an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Request failed' },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await expect(fetchApiData('/api/categories/math')).rejects.toMatchObject({
      name: 'ApiResponseError',
      message: 'Request failed',
    });
  });
});
