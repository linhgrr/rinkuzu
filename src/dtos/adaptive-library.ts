import { z } from 'zod';

export const adaptiveLibraryImagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict();

export interface AdaptiveLibraryImagesDto {
  images: string[];
}
