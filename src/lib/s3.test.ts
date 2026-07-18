import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());
const deleteObjectInputs = vi.hoisted(() => [] as Array<{ Bucket: string; Key: string }>);
const getObjectInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = sendMock;
  },
  GetObjectCommand: class {
    _type = 'GetObject' as const;
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
      getObjectInputs.push(input);
    }
  },
  DeleteObjectCommand: class {
    _type = 'DeleteObject' as const;
    constructor(input: { Bucket: string; Key: string }) {
      Object.assign(this, input);
      deleteObjectInputs.push(input);
    }
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock('@/lib/env', () => ({
  env: {
    OBJECT_STORAGE_ENDPOINT_EXTERNAL: 'https://cdn.example.com/',
    OBJECT_STORAGE_REGION: 'auto',
    OBJECT_STORAGE_ADDRESSING_STYLE: 'path',
    OBJECT_STORAGE_ACCESS_KEY: 'test-access-key',
    OBJECT_STORAGE_SECRET_KEY: 'test-secret-key',
    OBJECT_STORAGE_BUCKET: 'test-bucket',
  },
}));

import {
  BUCKET_NAME,
  deleteOwnedPdfUrlsBestEffort,
  deletePDF,
  extractOwnedObjectKeyFromUrl,
  getSignedPDFUrl,
} from '@/lib/s3';

describe('s3 object storage helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObjectInputs.length = 0;
    getObjectInputs.length = 0;
    sendMock.mockResolvedValue({});
    getSignedUrlMock.mockResolvedValue('https://cdn.example.com/signed.pdf');
  });

  it('exports the configured bucket name', () => {
    expect(BUCKET_NAME).toBe('test-bucket');
  });

  it('signs a PDF get URL with inline disposition', async () => {
    await expect(getSignedPDFUrl('quizzes/doc.pdf', 120)).resolves.toBe(
      'https://cdn.example.com/signed.pdf',
    );
    expect(getObjectInputs).toEqual([
      {
        Bucket: 'test-bucket',
        Key: 'quizzes/doc.pdf',
        ResponseContentDisposition: 'inline',
        ResponseContentType: 'application/pdf',
      },
    ]);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ send: sendMock }),
      expect.objectContaining({ _type: 'GetObject' }),
      { expiresIn: 120 },
    );
  });

  it('extracts owned keys and rejects foreign or unsafe URLs', () => {
    expect(
      extractOwnedObjectKeyFromUrl(
        'https://cdn.example.com/test-bucket/uploads/quiz_extract/user-1/file.pdf?sig=abc',
      ),
    ).toBe('uploads/quiz_extract/user-1/file.pdf');
    expect(
      extractOwnedObjectKeyFromUrl('https://cdn.example.com/other-bucket/uploads/file.pdf'),
    ).toBeNull();
    expect(extractOwnedObjectKeyFromUrl('https://cdn.example.com/test-bucket/')).toBeNull();
    expect(
      extractOwnedObjectKeyFromUrl('https://cdn.example.com/test-bucket/uploads/../escape.pdf'),
    ).toBeNull();
    expect(
      extractOwnedObjectKeyFromUrl('https://evil.example.com/test-bucket/uploads/file.pdf'),
    ).toBeNull();
    expect(
      extractOwnedObjectKeyFromUrl('https://cdn.example.com/test-bucket/uploads/%2e%2e/escape.pdf'),
    ).toBeNull();
    expect(extractOwnedObjectKeyFromUrl('')).toBeNull();
  });

  it('deletes by key via DeleteObject and treats empty keys as no-ops', async () => {
    await deletePDF('uploads/quiz_extract/user-1/file.pdf');
    expect(deleteObjectInputs).toEqual([
      {
        Bucket: 'test-bucket',
        Key: 'uploads/quiz_extract/user-1/file.pdf',
      },
    ]);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'uploads/quiz_extract/user-1/file.pdf',
      }),
    );

    deleteObjectInputs.length = 0;
    sendMock.mockClear();
    await deletePDF('');
    expect(deleteObjectInputs).toEqual([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('best-effort deletes owned URLs only, dedupes keys, and never throws on upstream failure', async () => {
    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('upstream unavailable'));

    await expect(
      deleteOwnedPdfUrlsBestEffort([
        'https://cdn.example.com/test-bucket/uploads/a.pdf',
        'https://cdn.example.com/test-bucket/uploads/a.pdf?sig=1',
        'https://cdn.example.com/foreign-bucket/uploads/b.pdf',
        'https://cdn.example.com/test-bucket/uploads/c.pdf',
        null,
        undefined,
        '',
      ]),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectInputs).toEqual([
      { Bucket: 'test-bucket', Key: 'uploads/a.pdf' },
      { Bucket: 'test-bucket', Key: 'uploads/c.pdf' },
    ]);
  });
});
