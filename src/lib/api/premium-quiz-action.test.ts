import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { PremiumQuizError } from '@/entities/PremiumQuizError';
import {
  withPremiumRead,
  withPremiumSessionAction,
  withPremiumSessionStart,
  withPremiumSubmissionRead,
} from '@/lib/api/premium-quiz-action';

const SESSION_ID = '507f191e810c19729de860ed';
const QUIZ_ID = '507f191e810c19729de860ea';
const USER_ID = '507f191e810c19729de860ee';
const CURSOR = 'a-cursor-long-enough-to-pass';

function learnerSession(role = 'user') {
  return { user: { id: USER_ID, email: 'learner@example.test', role } };
}

function postRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/premium-quizzes/sessions/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/**
 * Everything these routes return is paid content, so the private cache headers
 * are not decoration: without them a shared cache is free to keep a paying
 * learner's batch and hand it to the next request. They belong to the failure
 * path too, since a 409 still names a session that exists. The assertions below
 * check both, because the wrapper is now the only thing applying them.
 */
const PRIVATE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Cache-Control', 'private, no-store, max-age=0'],
  ['Pragma', 'no-cache'],
  ['X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex'],
];

function expectPrivate(response: Response): void {
  for (const [name, value] of PRIVATE_HEADERS) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe('withPremiumSessionAction', () => {
  const run = vi.fn();
  const route = withPremiumSessionAction(
    z.strictObject({ cursor: z.string().min(16) }),
    'Get Premium quiz batch failed',
    run,
  );
  const context = { params: Promise.resolve({ sessionId: SESSION_ID }) };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(learnerSession());
    run.mockResolvedValue({ questions: [] });
  });

  it('hands the action the caller, the session and the validated body', async () => {
    const response = await route(postRequest({ cursor: CURSOR }), context);

    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(run).toHaveBeenCalledWith({ userId: USER_ID, role: 'user' }, SESSION_ID, {
      cursor: CURSOR,
    });
  });

  it('keeps the private headers on a domain refusal', async () => {
    run.mockRejectedValue(new PremiumQuizError('session_expired', 'This session has ended'));

    const response = await route(postRequest({ cursor: CURSOR }), context);

    expect(response.status).toBe(409);
    expectPrivate(response);
  });

  it('maps an unpaid session to the status the client upsells on', async () => {
    run.mockRejectedValue(new PremiumQuizError('insufficient_credits', 'Not enough credits'));

    const response = await route(postRequest({ cursor: CURSOR }), context);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'premium_required' },
    });
  });

  it('refuses a malformed session id before the body is read', async () => {
    const response = await route(postRequest({ cursor: CURSOR }), {
      params: Promise.resolve({ sessionId: 'not-an-id' }),
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.meta.fields).toHaveProperty('sessionId');
    expect(run).not.toHaveBeenCalled();
  });

  it('is closed to anyone without a session', async () => {
    authMock.mockResolvedValue(null);

    const response = await route(postRequest({ cursor: CURSOR }), context);

    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('withPremiumSessionStart', () => {
  const run = vi.fn();
  const route = withPremiumSessionStart('Start Premium quiz session failed', run);
  const context = { params: Promise.resolve({ id: QUIZ_ID }) };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(learnerSession());
    run.mockResolvedValue({ sessionId: SESSION_ID });
  });

  it('answers 201, because opening a session creates one', async () => {
    const response = await route(postRequest(), context);

    expect(response.status).toBe(201);
    expectPrivate(response);
    expect(run).toHaveBeenCalledWith({ userId: USER_ID, role: 'user' }, QUIZ_ID);
  });

  it('refuses a malformed quiz id', async () => {
    const response = await route(postRequest(), { params: Promise.resolve({ id: 'nope' }) });

    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('withPremiumRead', () => {
  const run = vi.fn();
  const route = withPremiumRead('Get credit wallet failed', run);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(learnerSession());
    run.mockResolvedValue({ balance: 3 });
  });

  it('reads for the caller and keeps the answer out of shared caches', async () => {
    const response = await route(postRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(run).toHaveBeenCalledWith(USER_ID);
  });
});

describe('withPremiumSubmissionRead', () => {
  const run = vi.fn();
  const route = withPremiumSubmissionRead('Get Premium quiz submission failed', run);
  const context = { params: Promise.resolve({ id: QUIZ_ID }) };

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(learnerSession('admin'));
    run.mockResolvedValue({ id: QUIZ_ID });
  });

  it('is closed to a signed-in non-admin', async () => {
    authMock.mockResolvedValue(learnerSession());

    const response = await route(postRequest(), context);

    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('gives an operator the same private headers a player gets', async () => {
    const response = await route(postRequest(), context);

    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(run).toHaveBeenCalledWith(QUIZ_ID);
  });
});
