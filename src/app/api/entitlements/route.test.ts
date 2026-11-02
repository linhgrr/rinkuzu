import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, reconcilePipelineMock, reconcileQuizMock, usageSnapshotMock } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    reconcilePipelineMock: vi.fn(),
    reconcileQuizMock: vi.fn(),
    usageSnapshotMock: vi.fn(),
  }),
);

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/entitlements', () => ({
  can: () => false,
  getConstraint: () => 30,
  isMeteredCapabilityEnabled: () => true,
  resolveEntitlements: vi.fn().mockResolvedValue({ tier: 'free' }),
}));
vi.mock('@/lib/llm/rate-limit', () => ({ getLlmUsageSnapshot: usageSnapshotMock }));
vi.mock('@/lib/adaptive/pipeline-usage', () => ({
  reconcilePipelineUsage: reconcilePipelineMock,
}));
vi.mock('@/lib/quiz/draft-usage', () => ({ reconcileQuizDraftUsage: reconcileQuizMock }));

import { GET } from '@/app/api/entitlements/route';

const routeContext = { params: Promise.resolve({}) };

function session(role: 'user' | 'admin' = 'user') {
  return { user: { id: 'user-1', email: 'user@example.com', role } };
}

function request(): NextRequest {
  return new NextRequest('http://localhost/api/entitlements');
}

describe('GET /api/entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    usageSnapshotMock.mockResolvedValue([
      {
        window: 'month',
        count: 1,
        limit: 5,
        remaining: 4,
        resetAt: new Date('2026-12-01T00:00:00.000Z'),
      },
    ]);
  });

  it('settles failed async uploads before reporting remaining usage', async () => {
    const order: string[] = [];
    reconcileQuizMock.mockImplementation(async () => order.push('quiz'));
    reconcilePipelineMock.mockImplementation(async () => order.push('pipeline'));
    usageSnapshotMock.mockImplementation(async () => {
      order.push('snapshot');
      return [];
    });

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(200);
    expect(reconcileQuizMock).toHaveBeenCalledWith({ userId: 'user-1', userRole: 'user' });
    expect(reconcilePipelineMock).toHaveBeenCalledWith({ userId: 'user-1', userRole: 'user' });
    expect(order.slice(0, 2).sort()).toEqual(['pipeline', 'quiz']);
    expect(order.slice(2).every((step) => step === 'snapshot')).toBe(true);
  });

  it('reports quiz_extract usage from the ledger snapshot', async () => {
    const response = await GET(request(), routeContext);
    const body = await response.json();

    expect(body.data.capabilities.quiz_extract.windows).toEqual([
      {
        window: 'month',
        used: 1,
        limit: 5,
        remaining: 4,
        resetsAt: '2026-12-01T00:00:00.000Z',
      },
    ]);
  });

  it('does not meter or reconcile admins', async () => {
    authMock.mockResolvedValue(session('admin'));

    const response = await GET(request(), routeContext);
    const body = await response.json();

    expect(reconcileQuizMock).not.toHaveBeenCalled();
    expect(reconcilePipelineMock).not.toHaveBeenCalled();
    expect(usageSnapshotMock).not.toHaveBeenCalled();
    expect(body.data.capabilities.quiz_extract).toMatchObject({ unmetered: true, windows: [] });
  });

  it('answers 503 when usage cannot be read', async () => {
    usageSnapshotMock.mockRejectedValue(new Error('db down'));

    const response = await GET(request(), routeContext);

    expect(response.status).toBe(503);
  });
});
