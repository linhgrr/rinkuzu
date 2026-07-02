import { describe, expect, it } from 'vitest';
import { createPresignedUploadUrlRequestSchema } from '@/dtos/storage';

describe('storage DTO validation', () => {
  it('validates presigned PDF upload requests', () => {
    expect(
      createPresignedUploadUrlRequestSchema.parse({
        fileName: '  source.pdf  ',
        contentType: 'application/pdf',
        fileSize: 1024,
        purpose: 'quiz',
      }),
    ).toEqual({
      fileName: 'source.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      purpose: 'quiz',
    });
  });

  it('rejects unsupported upload inputs', () => {
    expect(() =>
      createPresignedUploadUrlRequestSchema.parse({
        fileName: 'source.png',
        contentType: 'image/png',
        fileSize: 1024,
        purpose: 'quiz',
      }),
    ).toThrow();
    expect(() =>
      createPresignedUploadUrlRequestSchema.parse({
        fileName: 'source.pdf',
        contentType: 'application/pdf',
        fileSize: 50 * 1024 * 1024 + 1,
        purpose: 'quiz',
      }),
    ).toThrow();
  });
});
