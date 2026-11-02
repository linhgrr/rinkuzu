import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getSignedUrlMock,
  loggerErrorMock,
  reconcileUsageMock,
  uploadRateMock,
  usageSnapshotMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  reconcileUsageMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  uploadRateMock: vi.fn(),
  usageSnapshotMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class PutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
}));
vi.mock('@/lib/entitlements', () => ({
  resolveEntitlements: vi.fn().mockResolvedValue({ tier: 'free' }),
}));
vi.mock('@/lib/llm/rate-limit', () => ({
  getLlmUsageSnapshot: usageSnapshotMock,
}));
vi.mock('@/lib/adaptive/pipeline-usage', () => ({
  reconcilePipelineUsage: reconcileUsageMock,
}));
vi.mock('@/lib/auth-rate-limit', () => ({
  checkAuthRateLimit: uploadRateMock,
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock('@/lib/s3', () => ({
  s3Client: { region: 'test' },
  BUCKET_NAME: 'test-bucket',
  getQuizPdfObjectPrefix: (userId: string) => `uploads/quiz_extract/${userId}/`,
}));

import { dynamic, POST } from '@/app/api/storage/presigned-url/route';

const routeContext = { params: Promise.resolve({}) };

function session() {
  return { user: { id: 'user-1', email: 'user@example.com', role: 'user' } };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/storage/presigned-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  fileName: 'My File (1).pdf',
  contentType: 'application/pdf' as const,
  fileSize: 1024,
  purpose: 'quiz' as const,
};

describe('POST /api/storage/presigned-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    usageSnapshotMock.mockResolvedValue([
      {
        window: 'month',
        count: 0,
        limit: 5,
        remaining: 5,
        resetAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);
    uploadRateMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetSeconds: 900,
      limit: 20,
    });
    getSignedUrlMock.mockResolvedValue('https://s3.example/upload');
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  it('is force-dynamic and requires authentication', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValueOnce(null);
    expect((await POST(request(validBody), routeContext)).status).toBe(401);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads without signing', async () => {
    const response = await POST(
      request({ ...validBody, contentType: 'image/png', fileName: '' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'validation_error' },
    });
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('creates quiz and adaptive upload keys with sanitized file names', async () => {
    const quiz = await POST(request(validBody), routeContext);
    expect(quiz.status).toBe(200);
    await expect(quiz.json()).resolves.toEqual({
      success: true,
      data: {
        uploadUrl: 'https://s3.example/upload',
        uploadMethod: 'PUT',
        uploadHeaders: { 'Content-Type': 'application/pdf' },
        uploadFields: {},
        s3Key: 'uploads/quiz_extract/user-1/1700000000000-My_File__1_.pdf',
        expiresIn: 300,
      },
    });
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      { region: 'test' },
      expect.objectContaining({
        input: {
          Bucket: 'test-bucket',
          Key: 'uploads/quiz_extract/user-1/1700000000000-My_File__1_.pdf',
          ContentType: 'application/pdf',
          ContentLength: 1024,
        },
      }),
      { expiresIn: 300 },
    );

    const adaptive = await POST(
      request({ ...validBody, purpose: 'adaptive', fileName: 'source.pdf' }),
      routeContext,
    );
    expect(adaptive.status).toBe(200);
    await expect(adaptive.json()).resolves.toMatchObject({
      data: {
        s3Key: 'uploads/adaptive_pipeline/user-1/1700000000000-source.pdf',
        expiresIn: 300,
      },
    });
  });

  it('logs signing failures and returns an upstream error envelope', async () => {
    getSignedUrlMock.mockRejectedValueOnce(new Error('signer down'));

    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(500);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'Failed to create presigned upload URL',
    );
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_error', detail: 'signer down' },
    });
  });

  it('settles failed adaptive jobs before checking the adaptive quota', async () => {
    const order: string[] = [];
    reconcileUsageMock.mockImplementation(async () => order.push('reconcile'));
    usageSnapshotMock.mockImplementation(async () => {
      order.push('snapshot');
      return [
        {
          window: 'month',
          count: 1,
          limit: 2,
          remaining: 1,
          resetAt: new Date('2026-12-01T00:00:00.000Z'),
        },
      ];
    });

    const response = await POST(request({ ...validBody, purpose: 'adaptive' }), routeContext);

    expect(response.status).toBe(200);
    expect(reconcileUsageMock).toHaveBeenCalledWith({ userId: 'user-1', userRole: 'user' });
    expect(order).toEqual(['reconcile', 'snapshot']);
  });

  it('does not reconcile pipeline jobs for quiz uploads or admins', async () => {
    await POST(request(validBody), routeContext);
    authMock.mockResolvedValue({ user: { ...session().user, role: 'admin' } });
    await POST(request({ ...validBody, purpose: 'adaptive' }), routeContext);

    expect(reconcileUsageMock).not.toHaveBeenCalled();
  });

  it('rejects exhausted users before issuing an upload policy', async () => {
    usageSnapshotMock.mockResolvedValueOnce([
      {
        window: 'month',
        count: 5,
        limit: 5,
        remaining: 0,
        resetAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);

    const response = await POST(request(validBody), routeContext);

    expect(response.status).toBe(429);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'quota_exceeded',
        meta: { capability: 'quiz_extract', tier: 'free', upgradeEligible: true },
      },
    });
  });
});
