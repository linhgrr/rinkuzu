import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getQuestionMock, updateQuestionMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getQuestionMock: vi.fn(),
  updateQuestionMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/admin-factory', () => ({
  getAdminService: () => ({
    getReportedQuestion: getQuestionMock,
    updateReportedQuestion: updateQuestionMock,
  }),
}));

import { GET, PATCH } from '@/app/api/admin/reports/[id]/question/route';

const reportId = '507f1f77bcf86cd799439011';
const context = { params: Promise.resolve({ id: reportId }) };
const question = {
  id: '507f1f77bcf86cd799439012',
  index: 2,
  question: 'Which answer is correct?',
  options: ['A', 'B'],
  type: 'single' as const,
  correctIndex: 1,
};

function request(body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/reports/${reportId}/question`, {
    ...(body === undefined
      ? {}
      : {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
}

describe('/api/admin/reports/[id]/question', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' },
    });
  });

  it('returns the live question for an admin', async () => {
    getQuestionMock.mockResolvedValue({ success: true, data: question });

    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(getQuestionMock).toHaveBeenCalledWith(reportId);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: question });
  });

  it('validates and updates only the reported question', async () => {
    updateQuestionMock.mockResolvedValue({ success: true, data: question });
    const input = {
      question: ' Which answer is correct? ',
      options: [' A ', ' B '],
      type: 'single',
      correctIndex: 1,
    };

    const response = await PATCH(request(input), context);

    expect(response.status).toBe(200);
    expect(updateQuestionMock).toHaveBeenCalledWith(reportId, {
      question: 'Which answer is correct?',
      options: ['A', 'B'],
      type: 'single',
      correctIndex: 1,
    });
  });

  it('rejects invalid answer keys and maps legacy reports to conflict', async () => {
    const invalid = await PATCH(
      request({
        question: 'Question',
        options: ['A', 'B'],
        type: 'single',
        correctIndex: 4,
      }),
      context,
    );
    expect(invalid.status).toBe(400);
    expect(updateQuestionMock).not.toHaveBeenCalled();

    getQuestionMock.mockResolvedValue({
      success: false,
      error: 'This legacy report is not linked to a specific question',
      statusCode: 409,
    });
    const legacy = await GET(request(), context);
    expect(legacy.status).toBe(409);
  });
});
