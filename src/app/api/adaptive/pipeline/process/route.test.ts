import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getSignedUrlMock,
  invalidateCacheMock,
  loggerErrorMock,
  proxyAdaptiveRequestMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  invalidateCacheMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  proxyAdaptiveRequestMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/adaptive/cache-policy', () => ({
  invalidateAdaptiveServiceCache: invalidateCacheMock,
}));
vi.mock('@/lib/adaptive/proxy', () => ({
  proxyAdaptiveRequest: proxyAdaptiveRequestMock,
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));
vi.mock('@/lib/s3', () => ({
  s3Client: { region: 'test' },
  BUCKET_NAME: 'test-bucket',
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock },
}));

import { POST, dynamic } from '@/app/api/adaptive/pipeline/process/route';

const USER_ID = 'user-1';
const OWNED_KEY = `uploads/adaptive_pipeline/${USER_ID}/1710000000000-source.pdf`;

function session(overrides?: { id?: string; email?: string; role?: string }) {
  return {
    user: {
      id: overrides?.id ?? USER_ID,
      email: overrides?.email ?? 'user@example.com',
      role: overrides?.role ?? 'user',
    },
  };
}

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/adaptive/pipeline/process', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const routeContext = { params: Promise.resolve({}) };

describe('POST /api/adaptive/pipeline/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue(session());
    getSignedUrlMock.mockResolvedValue('https://signed.example/file.pdf');
    proxyAdaptiveRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { job_id: 'job-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('requires authentication before validating the body', async () => {
    expect(dynamic).toBe('force-dynamic');
    authMock.mockResolvedValue(null);

    const response = await POST(
      request({ s3Key: OWNED_KEY, filename: 'source.pdf' }),
      routeContext,
    );

    expect(response.status).toBe(401);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
  });

  it('rejects invalid bodies without signing or proxying', async () => {
    const response = await POST(request({ filename: 'source.pdf' }), routeContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_error');
    expect(body.error.meta?.issues).toBeDefined();
    expect(typeof body.error.meta.issues).toBe('object');
    expect(Object.keys(body.error.meta.issues as Record<string, string>).length).toBeGreaterThan(0);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('denies foreign s3Key namespaces and never proxies', async () => {
    const foreignKey = 'uploads/adaptive_pipeline/other-user/1710000000000-source.pdf';
    const response = await POST(
      request({ s3Key: foreignKey, filename: 'source.pdf' }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'validation_error',
        detail: 's3Key is outside the authenticated user namespace',
      },
    });
    expect(getSignedUrlMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('denies traversal and unsafe s3Key shapes without proxying', async () => {
    const unsafeKeys = [
      `uploads/adaptive_pipeline/${USER_ID}/../other/source.pdf`,
      `uploads/adaptive_pipeline/${USER_ID}/./source.pdf`,
      `uploads/adaptive_pipeline/${USER_ID}/%2e%2e/other.pdf`,
      `uploads/adaptive_pipeline/${USER_ID}//source.pdf`,
      '/uploads/adaptive_pipeline/' + USER_ID + '/source.pdf',
    ];

    for (const s3Key of unsafeKeys) {
      const response = await POST(request({ s3Key, filename: 'source.pdf' }), routeContext);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'validation_error' },
      });
    }

    expect(getSignedUrlMock).not.toHaveBeenCalled();
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(invalidateCacheMock).not.toHaveBeenCalled();
  });

  it('signs the owned key, proxies with server-derived source_s3_key, and invalidates cache', async () => {
    const response = await POST(
      request({
        s3Key: OWNED_KEY,
        filename: 'source.pdf',
        subject_id: 'Algebra I',
        page_batch_size: 5,
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      { region: 'test' },
      expect.objectContaining({
        input: { Bucket: 'test-bucket', Key: OWNED_KEY },
      }),
      { expiresIn: 3600 },
    );
    expect(proxyAdaptiveRequestMock).toHaveBeenCalledWith(
      expect.any(NextRequest),
      '/pipeline/process',
      { userId: USER_ID, userRole: 'user' },
      {
        method: 'POST',
        llmAction: 'adaptive_pipeline',
        body: JSON.stringify({
          file_url: 'https://signed.example/file.pdf',
          filename: 'source.pdf',
          source_s3_key: OWNED_KEY,
          subject_id: 'Algebra I',
          page_batch_size: 5,
          min_confidence: 0.6,
          apply_reduction: true,
        }),
        contentType: 'application/json',
        timeoutMs: 180_000,
      },
    );
    expect(invalidateCacheMock).toHaveBeenCalledOnce();
  });

  it('omits subject_id from the proxy body when not provided', async () => {
    await POST(request({ s3Key: OWNED_KEY, filename: 'source.pdf' }), routeContext);

    const proxyArgs = proxyAdaptiveRequestMock.mock.calls[0]?.[3] as { body?: string } | undefined;
    const proxied = JSON.parse(proxyArgs?.body ?? '{}') as Record<string, unknown>;
    expect(proxied).not.toHaveProperty('subject_id');
    expect(proxied).toMatchObject({
      source_s3_key: OWNED_KEY,
      page_batch_size: 10,
      min_confidence: 0.6,
      apply_reduction: true,
    });
  });

  it('maps unexpected failures to a safe 500 without leaving the proxy path half-open', async () => {
    getSignedUrlMock.mockRejectedValue(new Error('sign failed'));

    const response = await POST(
      request({ s3Key: OWNED_KEY, filename: 'source.pdf' }),
      routeContext,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'internal_error',
        detail: 'Internal server error while processing upload',
      },
    });
    expect(proxyAdaptiveRequestMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error proxying pipeline process request',
    );
  });
});
