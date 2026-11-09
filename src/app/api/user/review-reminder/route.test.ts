import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, optInMock, adaptiveOptInMock, optOutMock, statusMock, snoozeMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    optInMock: vi.fn(),
    adaptiveOptInMock: vi.fn(),
    optOutMock: vi.fn(),
    statusMock: vi.fn(),
    snoozeMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/communication/review-reminder', () => ({
  optInAdaptiveReviewReminder: adaptiveOptInMock,
  optInReviewReminder: optInMock,
  optOutReviewReminder: optOutMock,
  reviewReminderStatus: statusMock,
  snoozeReviewReminderPrompt: snoozeMock,
}));

import { DELETE, GET, POST } from '@/app/api/user/review-reminder/route';

const ATTEMPT_ID = '6a8ed20a3d0a1892cacdfe0b';
const routeContext = { params: Promise.resolve({}) };

function request(method: string, body: unknown, sameOrigin = true): NextRequest {
  return new NextRequest('http://localhost/api/user/review-reminder', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(sameOrigin ? { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('/api/user/review-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'learner@gmail.com', role: 'user' },
    });
    optInMock.mockResolvedValue({ optedIn: true, status: 'scheduled', scheduledFor: 'x' });
    adaptiveOptInMock.mockResolvedValue({ optedIn: true, status: 'scheduled', scheduledFor: 'y' });
    optOutMock.mockResolvedValue({ optedIn: false });
    statusMock.mockResolvedValue({ optedIn: true, snoozedUntil: null, eligible: true });
    snoozeMock.mockResolvedValue({ snoozedUntil: '2026-11-16T10:00:00.000Z' });
  });

  it('GET reports the prompt status for the attempt (RIN-1362)', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/user/review-reminder?attemptId=${ATTEMPT_ID}`),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      optedIn: true,
      snoozedUntil: null,
      eligible: true,
    });
    expect(statusMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'learner@gmail.com',
      attemptId: ATTEMPT_ID,
      path: 'quiz',
    });
  });

  it('GET ?path=adaptive reports the adaptive end-screen status (RIN-1364)', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/review-reminder?path=adaptive'),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(statusMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'learner@gmail.com',
      attemptId: undefined,
      path: 'adaptive',
    });
  });

  it('POST path:adaptive opts in on the latest completion, with no client timestamps', async () => {
    const response = await POST(request('POST', { path: 'adaptive', locale: 'en' }), routeContext);
    expect(response.status).toBe(200);
    expect(adaptiveOptInMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'learner@gmail.com',
      locale: 'en',
      ip: null,
    });
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('POST path:adaptive rejects a client-sent anchor', async () => {
    const response = await POST(
      request('POST', { path: 'adaptive', completedAt: '2026-11-01T00:00:00Z' }),
      routeContext,
    );
    expect(response.status).toBe(400);
    expect(adaptiveOptInMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'POST optIn:false',
      () => POST(request('POST', { path: 'adaptive', optIn: false }), routeContext),
    ],
    ['DELETE', () => DELETE(request('DELETE', { path: 'adaptive' }), routeContext)],
  ])('%s on the adaptive screen un-ticks it with its own source', async (_label, call) => {
    expect((await call()).status).toBe(200);
    expect(optOutMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', source: 'adaptive_end_review' }),
    );
    expect(adaptiveOptInMock).not.toHaveBeenCalled();
  });

  it('GET rejects an invalid attempt id', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/user/review-reminder?attemptId=nope'),
      routeContext,
    );
    expect(response.status).toBe(400);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('POST action:snooze snoozes the prompt and changes no consent (RIN-1362)', async () => {
    const response = await POST(
      request('POST', { attemptId: ATTEMPT_ID, action: 'snooze' }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ snoozedUntil: '2026-11-16T10:00:00.000Z' });
    expect(snoozeMock).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(optInMock).not.toHaveBeenCalled();
    expect(optOutMock).not.toHaveBeenCalled();
  });

  it('GET requires a signed-in learner', async () => {
    authMock.mockResolvedValueOnce(null);
    const response = await GET(
      new NextRequest('http://localhost/api/user/review-reminder'),
      routeContext,
    );
    expect(response.status).toBe(401);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('requires a signed-in learner', async () => {
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request('POST', { attemptId: ATTEMPT_ID }), routeContext)).status).toBe(401);
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('rejects a cross-site request', async () => {
    const response = await POST(request('POST', { attemptId: ATTEMPT_ID }, false), routeContext);
    expect(response.status).toBe(403);
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid attempt id', async () => {
    const response = await POST(request('POST', { attemptId: 'nope' }), routeContext);
    expect(response.status).toBe(400);
    expect(optInMock).not.toHaveBeenCalled();
  });

  it('opts the session user in for the attempt', async () => {
    const response = await POST(
      request('POST', { attemptId: ATTEMPT_ID, locale: 'en' }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(optInMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        email: 'learner@gmail.com',
        attemptId: ATTEMPT_ID,
        locale: 'en',
      }),
    );
  });

  it.each([
    [
      'POST optIn:false',
      () => POST(request('POST', { attemptId: ATTEMPT_ID, optIn: false }), routeContext),
    ],
    ['DELETE', () => DELETE(request('DELETE', { attemptId: ATTEMPT_ID }), routeContext)],
  ])('%s un-ticks it', async (_label, call) => {
    expect((await call()).status).toBe(200);
    expect(optOutMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', source: 'result_page_review' }),
    );
    expect(optInMock).not.toHaveBeenCalled();
  });
});
