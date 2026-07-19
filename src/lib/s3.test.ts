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
  getQuizPdfObjectPrefix,
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

  it('builds a bounded quiz PDF namespace and rejects unsafe owner ids', () => {
    expect(getQuizPdfObjectPrefix('user-1')).toBe('uploads/quiz_extract/user-1/');
    expect(() => getQuizPdfObjectPrefix('../victim')).toThrow('Invalid quiz PDF owner id');
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

  it('best-effort deletes owned URLs only, dedupes keys, and never throws on upstream failure', async () => {
    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('upstream unavailable'));

    await expect(
      deleteOwnedPdfUrlsBestEffort(
        [
          'https://cdn.example.com/test-bucket/uploads/quiz_extract/user-1/a.pdf',
          'https://cdn.example.com/test-bucket/uploads/quiz_extract/user-1/a.pdf?sig=1',
          'https://cdn.example.com/test-bucket/uploads/quiz_extract/user-2/b.pdf',
          'https://cdn.example.com/test-bucket/uploads/quiz_extract/user-1/c.pdf',
          null,
          undefined,
          '',
        ],
        getQuizPdfObjectPrefix('user-1'),
      ),
    ).resolves.toBeUndefined();

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(deleteObjectInputs).toEqual([
      { Bucket: 'test-bucket', Key: 'uploads/quiz_extract/user-1/a.pdf' },
      { Bucket: 'test-bucket', Key: 'uploads/quiz_extract/user-1/c.pdf' },
    ]);
  });

  it('does not delete same-bucket URLs outside the required owner namespace', async () => {
    await deleteOwnedPdfUrlsBestEffort(
      ['https://cdn.example.com/test-bucket/uploads/quiz_extract/user-2/victim.pdf'],
      getQuizPdfObjectPrefix('user-1'),
    );

    expect(sendMock).not.toHaveBeenCalled();
    expect(deleteObjectInputs).toEqual([]);
  });

  it('rejects foreign and unsafe URLs before deletion', async () => {
    const unsafeUrls = [
      'https://cdn.example.com/other-bucket/uploads/file.pdf',
      'https://cdn.example.com/test-bucket/',
      'https://cdn.example.com/test-bucket/uploads/../escape.pdf',
      'https://evil.example.com/test-bucket/uploads/quiz_extract/user-1/file.pdf',
      'https://cdn.example.com/test-bucket/uploads/%2e%2e/escape.pdf',
      '',
    ];

    await deleteOwnedPdfUrlsBestEffort(unsafeUrls, getQuizPdfObjectPrefix('user-1'));

    expect(sendMock).not.toHaveBeenCalled();
    expect(deleteObjectInputs).toEqual([]);
  });
});
