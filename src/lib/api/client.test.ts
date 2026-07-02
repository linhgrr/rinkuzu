import { fetchApiData, fetchApiResponse } from '@/lib/api/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('api client helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchApiResponse preserves the standard success envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: [{ _id: 'plan-1', name: 'Pro' }],
          meta: { message: 'ok' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      fetchApiResponse<Array<{ _id: string; name: string }>>('/api/admin/plans'),
    ).resolves.toEqual({
      success: true,
      data: [{ _id: 'plan-1', name: 'Pro' }],
      meta: { message: 'ok' },
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

  it('rejects 204 responses because they violate the standard envelope contract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      fetchApiData<null>('/api/bookmarks/abc', { method: 'DELETE' }),
    ).rejects.toMatchObject({
      name: 'ApiResponseError',
      code: 'invalid_response_envelope',
      status: 204,
    });
  });

  it('throws ApiResponseError when the API returns an error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'validation_error',
              message: 'Invalid request',
              detail: 'Request failed',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await expect(fetchApiData('/api/quizzes/missing')).rejects.toMatchObject({
      name: 'ApiResponseError',
      code: 'validation_error',
      message: 'Request failed',
    });
  });

  it('throws ApiResponseError when the API returns a non-standard payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ quizzes: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(fetchApiData('/api/quizzes?page=1')).rejects.toMatchObject({
      name: 'ApiResponseError',
      code: 'invalid_response_envelope',
    });
  });
});
