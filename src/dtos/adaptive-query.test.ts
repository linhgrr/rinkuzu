import { describe, expect, it } from 'vitest';
import { adaptiveLibraryImagesQuerySchema } from '@/dtos/adaptive-library';
import {
  adaptivePipelineJobsQuerySchema,
  adaptivePipelineProcessRequestSchema,
} from '@/dtos/adaptive-pipeline';

describe('adaptive query DTOs', () => {
  it('applies route defaults', () => {
    expect(adaptiveLibraryImagesQuerySchema.parse({})).toEqual({ limit: 12 });
    expect(adaptivePipelineJobsQuerySchema.parse({})).toEqual({ limit: 50 });
  });

  it('rejects invalid limits instead of clamping or forwarding them', () => {
    expect(adaptiveLibraryImagesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(adaptivePipelineJobsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('validates pipeline process body at the route boundary', () => {
    expect(
      adaptivePipelineProcessRequestSchema.parse({
        s3Key: 'users/user-1/source.pdf',
        filename: 'source.pdf',
        subject_id: 'algebra',
        page_batch_size: 8,
      }),
    ).toEqual({
      s3Key: 'users/user-1/source.pdf',
      filename: 'source.pdf',
      subject_id: 'algebra',
      page_batch_size: 8,
    });

    expect(adaptivePipelineProcessRequestSchema.safeParse({ filename: 'source.pdf' }).success).toBe(
      false,
    );
    expect(
      adaptivePipelineProcessRequestSchema.safeParse({
        s3Key: 'users/user-1/source.pdf',
        filename: 'source.pdf',
        page_batch_size: 0,
      }).success,
    ).toBe(false);
  });
});
