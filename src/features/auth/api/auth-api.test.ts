import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyEmail } from './auth-api';

function respond(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('verifyEmail', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the slug of the quiz the verification claimed (RIN-1487)', async () => {
    fetchMock.mockResolvedValue(
      respond({
        success: true,
        data: { email: 'learner@example.com', claimedQuizSlug: 'fake-quiz' },
        meta: { message: 'verified' },
      }),
    );

    await expect(verifyEmail('t'.repeat(32))).resolves.toEqual({
      message: 'verified',
      claimedQuizSlug: 'fake-quiz',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/verify-email',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 't'.repeat(32) }) }),
    );
  });

  it('returns no slug when the verification claimed nothing', async () => {
    fetchMock.mockResolvedValue(
      respond({ success: true, data: { email: 'learner@example.com' }, meta: {} }),
    );

    await expect(verifyEmail('t'.repeat(32))).resolves.toEqual({});
  });
});
