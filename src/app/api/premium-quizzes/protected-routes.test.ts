import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getBatchMock, getCatalogMetadataBySlugMock, startSessionMock, unlockMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    getBatchMock: vi.fn(),
    getCatalogMetadataBySlugMock: vi.fn(),
    startSessionMock: vi.fn(),
    unlockMock: vi.fn(),
  }));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/premium-quiz-factory', () => ({
  getPremiumQuizService: () => ({
    getBatch: getBatchMock,
    getCatalogMetadataBySlug: getCatalogMetadataBySlugMock,
    startSession: startSessionMock,
    unlock: unlockMock,
  }),
}));

import { GET as getPremiumMetadata } from '@/app/api/premium-quizzes/by-slug/[slug]/route';
import { POST as unlockPremiumQuiz } from '@/app/api/premium-quizzes/[id]/unlock/route';
import { POST as startPremiumSession } from '@/app/api/premium-quizzes/[id]/session/route';
import { POST as fetchPremiumBatch } from '@/app/api/premium-quizzes/sessions/[sessionId]/batch/route';

const QUIZ_ID = '507f191e810c19729de860ea';
const SESSION_ID = '507f191e810c19729de860ed';
const USER_ID = '507f191e810c19729de860ee';

function authenticatedSession() {
  return {
    user: { id: USER_ID, email: 'learner@example.com', role: 'user' },
  };
}

function jsonRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
}

describe('protected Premium quiz routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(authenticatedSession());
  });

  it('serves answer-free catalog metadata to anonymous visitors', async () => {
    authMock.mockResolvedValueOnce(null);
    getCatalogMetadataBySlugMock.mockResolvedValue({
      quizId: QUIZ_ID,
      title: 'Premium preview',
      slug: 'premium-preview',
      questionCount: 20,
    });

    const response = await getPremiumMetadata(
      new NextRequest('http://localhost/api/premium-quizzes/by-slug/premium-preview'),
      { params: Promise.resolve({ slug: 'premium-preview' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload.data).not.toHaveProperty('questions');
    expect(getCatalogMetadataBySlugMock).toHaveBeenCalledWith('premium-preview');
  });

  it('unlocks with the exact client idempotency key and protected headers', async () => {
    unlockMock.mockResolvedValue({ granted: true, alreadyGranted: false, balance: 2 });
    const idempotencyKey = '018f7494-8bd8-7b8a-a387-3bc5a14f22a1';

    const response = await unlockPremiumQuiz(
      jsonRequest(`http://localhost/api/premium-quizzes/${QUIZ_ID}/unlock`, { idempotencyKey }),
      { params: Promise.resolve({ id: QUIZ_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(unlockMock).toHaveBeenCalledWith(USER_ID, QUIZ_ID, idempotencyKey);
  });

  it('passes only the authenticated principal and quiz id when starting a session', async () => {
    startSessionMock.mockResolvedValue({ sessionId: SESSION_ID, questions: [] });

    const response = await startPremiumSession(
      jsonRequest(`http://localhost/api/premium-quizzes/${QUIZ_ID}/session`),
      { params: Promise.resolve({ id: QUIZ_ID }) },
    );

    expect(response.status).toBe(201);
    expect(startSessionMock).toHaveBeenCalledWith({ userId: USER_ID, role: 'user' }, QUIZ_ID);
  });

  it('returns a protected answer-free batch and rejects session theft before the service call', async () => {
    getBatchMock.mockResolvedValue({
      sessionId: SESSION_ID,
      questions: [{ id: 'question-1', question: '2 + 2?', options: ['3', '4'], type: 'single' }],
    });
    const cursor = 'opaque-cursor-value';

    const response = await fetchPremiumBatch(
      jsonRequest(`http://localhost/api/premium-quizzes/sessions/${SESSION_ID}/batch`, { cursor }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.questions[0]).not.toHaveProperty('correctIndex');
    expect(getBatchMock).toHaveBeenCalledWith(
      { userId: USER_ID, role: 'user' },
      SESSION_ID,
      cursor,
    );

    authMock.mockResolvedValueOnce(null);
    const unauthorized = await fetchPremiumBatch(
      jsonRequest(`http://localhost/api/premium-quizzes/sessions/${SESSION_ID}/batch`, { cursor }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) },
    );
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get('cache-control')).toContain('no-store');
    expect(getBatchMock).toHaveBeenCalledTimes(1);
  });
});
