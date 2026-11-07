import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMock = vi.hoisted(() => vi.fn());
const getSignedUrlMock = vi.hoisted(() => vi.fn());
const deleteObjectInputs = vi.hoisted(() => [] as Array<{ Bucket: string; Key: string }>);
const getObjectInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const copyObjectInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const putObjectInputs = vi.hoisted(() => [] as Array<Record<string, unknown>>);

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
  CopyObjectCommand: class {
    _type = 'CopyObject' as const;
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
      copyObjectInputs.push(input);
    }
  },
  PutObjectCommand: class {
    _type = 'PutObject' as const;
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
      putObjectInputs.push(input);
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
    IMAGE_PUBLIC_BASE_URL: 'https://img.example.test',
  },
}));

import {
  BUCKET_NAME,
  copyPremiumAssetToPrivateStorage,
  deleteOwnedPdfUrlsBestEffort,
  getQuizPdfObjectPrefix,
  getSignedPDFUrl,
  getSignedPremiumAssetUrl,
  getSignedPremiumSourceUrl,
} from '@/lib/s3';

describe('s3 object storage helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObjectInputs.length = 0;
    getObjectInputs.length = 0;
    copyObjectInputs.length = 0;
    putObjectInputs.length = 0;
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

  it('copies owned images into the private Premium namespace', async () => {
    const key = await copyPremiumAssetToPrivateStorage(
      'https://cdn.example.com/test-bucket/uploads/quiz_images/source.jpg',
      '507f191e810c19729de860ea',
    );

    expect(key).toMatch(/^premium\/assets\/507f191e810c19729de860ea\/[a-f0-9]{64}\.jpg$/);
    expect(copyObjectInputs).toEqual([
      {
        Bucket: 'test-bucket',
        Key: key,
        CopySource: encodeURIComponent('test-bucket/uploads/quiz_images/source.jpg'),
      },
    ]);
  });

  it('signs only private Premium asset keys with no-store response caching', async () => {
    await expect(
      getSignedPremiumAssetUrl('premium/assets/507f191e810c19729de860ea/image.jpg', 90),
    ).resolves.toBe('https://cdn.example.com/signed.pdf');
    expect(getObjectInputs.at(-1)).toEqual({
      Bucket: 'test-bucket',
      Key: 'premium/assets/507f191e810c19729de860ea/image.jpg',
      ResponseCacheControl: 'private, no-store, max-age=0',
    });
    expect(getSignedUrlMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ send: sendMock }),
      expect.objectContaining({ _type: 'GetObject' }),
      { expiresIn: 90 },
    );
    await expect(getSignedPremiumAssetUrl('uploads/quiz_images/source.jpg')).rejects.toThrow(
      'Invalid Premium asset key',
    );
  });

  it('signs retained Premium source PDFs only inside the admin source namespace', async () => {
    await expect(
      getSignedPremiumSourceUrl('uploads/premium_sources/quiz-1/source.pdf', 60),
    ).resolves.toBe('https://cdn.example.com/signed.pdf');
    expect(getObjectInputs.at(-1)).toEqual({
      Bucket: 'test-bucket',
      Key: 'uploads/premium_sources/quiz-1/source.pdf',
      ResponseContentDisposition: 'inline',
      ResponseContentType: 'application/pdf',
      ResponseCacheControl: 'private, no-store, max-age=0',
    });
    await expect(getSignedPremiumSourceUrl('uploads/quiz_extract/source.pdf')).rejects.toThrow(
      'Invalid Premium source key',
    );
  });

  it('fetch-copies public R2 images from the image host into the private Premium namespace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/webp', 'content-length': '3' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const key = await copyPremiumAssetToPrivateStorage(
        'https://img.example.test/images/question/2026/a.webp',
        '507f191e810c19729de860ea',
      );
      expect(key).toMatch(/^premium\/assets\/507f191e810c19729de860ea\/[a-f0-9]{64}\.webp$/);
      expect(putObjectInputs).toEqual([
        expect.objectContaining({ Bucket: 'test-bucket', Key: key, ContentType: 'image/webp' }),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['https://images.example.com/source.jpg', 'https://i.ibb.co/abc123/source.jpg'])(
    'rejects external Premium image host %s (only the image CDN is allowed)',
    async (url) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      try {
        await expect(
          copyPremiumAssetToPrivateStorage(url, '507f191e810c19729de860ea'),
        ).rejects.toThrow('Premium quiz images must come from managed image storage');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(putObjectInputs).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

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
