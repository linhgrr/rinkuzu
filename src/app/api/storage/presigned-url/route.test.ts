import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, getSignedUrlMock, loggerErrorMock, putObjectInputs } = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  putObjectInputs: [] as unknown[],
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
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
      putObjectInputs.push(input);
    }
  },
}));
vi.mock('@/lib/s3', () => ({
  s3Client: { region: 'test' },
  BUCKET_NAME: 'test-bucket',
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
    putObjectInputs.length = 0;
    authMock.mockResolvedValue(session());
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
        s3Key: 'uploads/quiz_extract/user-1/1700000000000-My_File__1_.pdf',
        expiresIn: 300,
      },
    });
    expect(putObjectInputs[0]).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploads/quiz_extract/user-1/1700000000000-My_File__1_.pdf',
      ContentType: 'application/pdf',
    });
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      { region: 'test' },
      expect.objectContaining({
        input: expect.objectContaining({
          Key: 'uploads/quiz_extract/user-1/1700000000000-My_File__1_.pdf',
        }),
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
});
