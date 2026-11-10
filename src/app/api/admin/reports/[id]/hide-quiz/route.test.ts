import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, hideReportedQuizMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  hideReportedQuizMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getAdminReportModerationService: () => ({ hideReportedQuiz: hideReportedQuizMock }),
}));

import { POST } from '@/app/api/admin/reports/[id]/hide-quiz/route';

const reportId = '507f1f77bcf86cd799439011';
const routeContext = { params: Promise.resolve({ id: reportId }) };

function post(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports/${reportId}/hide-quiz`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/reports/[id]/hide-quiz (RIN-1343)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
    hideReportedQuizMock.mockResolvedValue({
      success: true,
      data: { message: 'Quiz hidden and report resolved' },
    });
  });

  it('hides the quiz as the signed-in admin', async () => {
    const response = await POST(post({ adminNotes: 'textbook scan' }), routeContext);

    expect(response.status).toBe(200);
    expect(hideReportedQuizMock).toHaveBeenCalledWith(
      reportId,
      { id: 'admin-1', email: 'admin@example.com' },
      'textbook scan',
    );
  });

  it('refuses non-admins', async () => {
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'learner@example.com', role: 'user' },
    });

    const response = await POST(post({}), routeContext);

    expect(response.status).toBe(403);
    expect(hideReportedQuizMock).not.toHaveBeenCalled();
  });

  it('rejects unknown body fields', async () => {
    const response = await POST(post({ visibility: 'public' }), routeContext);

    expect(response.status).toBe(400);
    expect(hideReportedQuizMock).not.toHaveBeenCalled();
  });

  it('passes service failures through', async () => {
    hideReportedQuizMock.mockResolvedValueOnce({
      success: false,
      error: 'Report not found',
      statusCode: 404,
    });

    const response = await POST(post({}), routeContext);

    expect(response.status).toBe(404);
  });
});
