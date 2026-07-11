import { z } from 'zod';

export const adaptiveLibraryImagesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export interface AdaptiveLibraryImagesDto {
  images: string[];
}
