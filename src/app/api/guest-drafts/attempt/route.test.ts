import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { playMock, submitMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  submitMock: vi.fn(),
}));

vi.mock('@/lib/guest-draft-factory', () => ({
  getGuestDraftAttemptService: () => ({ play: playMock, submit: submitMock }),
}));

import { POST as ATTEMPT } from '@/app/api/guest-drafts/attempt/route';
import { POST as PLAY } from '@/app/api/guest-drafts/play/route';

const TOKEN = 'D'.repeat(43);
const CLAIM = 'C'.repeat(43);
const KEY = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/guest-drafts/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/guest-drafts/attempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes a valid attempt to the service and returns the score', async () => {
    const data = { attemptId: 'attempt-1', score: 50, correctAnswers: 1, totalQuestions: 2 };
    submitMock.mockResolvedValue({ success: true, data });
    const body = {
      token: TOKEN,
      guestClaimToken: CLAIM,
      answers: [1, [0, 2]],
      idempotencyKey: KEY,
    };

    const response = await ATTEMPT(post('attempt', body));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(data);
    expect(submitMock).toHaveBeenCalledWith(body);
  });

  it.each([
    ['no claim token', { token: TOKEN, answers: [1], idempotencyKey: KEY }],
    [
      'a bad draft token',
      { token: 'x', guestClaimToken: CLAIM, answers: [1], idempotencyKey: KEY },
    ],
    ['no answers', { token: TOKEN, guestClaimToken: CLAIM, answers: [], idempotencyKey: KEY }],
    [
      'an unknown field',
      { token: TOKEN, guestClaimToken: CLAIM, answers: [1], idempotencyKey: KEY, userId: 'u' },
    ],
  ])('400s %s without calling the service', async (_label, body) => {
    expect((await ATTEMPT(post('attempt', body))).status).toBe(400);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('maps a not-ready draft to 404', async () => {
    submitMock.mockResolvedValue({
      success: false,
      error: 'Guest draft not found',
      statusCode: 404,
    });
    const body = { token: TOKEN, guestClaimToken: CLAIM, answers: [1], idempotencyKey: KEY };
    const response = await ATTEMPT(post('attempt', body));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('not_found');
  });
});

describe('POST /api/guest-drafts/play', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the playable questions for the token in the body', async () => {
    const data = { title: 'Cells', questions: [] };
    playMock.mockResolvedValue({ success: true, data });

    const response = await PLAY(post('play', { token: TOKEN }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(data);
    expect(playMock).toHaveBeenCalledWith(TOKEN);
  });

  it('400s a missing token', async () => {
    expect((await PLAY(post('play', {}))).status).toBe(400);
    expect(playMock).not.toHaveBeenCalled();
  });
});
