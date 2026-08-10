import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock, deleteInputs, sendMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  deleteInputs: [] as unknown[],
  sendMock: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: class DeleteObjectCommand {
    constructor(input: unknown) {
      deleteInputs.push(input);
    }
  },
}));
vi.mock('@/lib/s3', () => ({
  BUCKET_NAME: 'test-bucket',
  getQuizPdfObjectPrefix: (userId: string) => `uploads/quiz_extract/${userId}/`,
  s3Client: { send: sendMock },
}));

import { DELETE } from '@/app/api/storage/upload/route';

const routeContext = { params: Promise.resolve({}) };

function request(body: unknown) {
  return new NextRequest('http://localhost/api/storage/upload', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('DELETE /api/storage/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteInputs.length = 0;
    authMock.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'user' },
    });
    sendMock.mockResolvedValue({});
  });

  it('deletes pending uploads only inside the authenticated namespace', async () => {
    const response = await DELETE(
      request({
        purpose: 'quiz',
        s3Key: 'uploads/quiz_extract/user-1/source.pdf',
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(deleteInputs).toEqual([
      { Bucket: 'test-bucket', Key: 'uploads/quiz_extract/user-1/source.pdf' },
    ]);

    const rejected = await DELETE(
      request({
        purpose: 'adaptive',
        s3Key: 'uploads/adaptive_pipeline/other-user/source.pdf',
      }),
      routeContext,
    );
    expect(rejected.status).toBe(400);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
