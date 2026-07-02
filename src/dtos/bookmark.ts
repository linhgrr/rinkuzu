import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import { objectIdRouteParamSchema } from '@/lib/validation/common';

export const bookmarkIdRouteParamsSchema = z.object({ id: objectIdRouteParamSchema }).strict();

export const bookmarkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const bookmarkQuestionSchema = z
  .object({
    text: z.string().trim().min(1),
    options: z.array(z.string()).min(2),
    type: z.enum(['single', 'multiple']),
    correctIndex: z.number().int().min(0).optional(),
    correctIndexes: z.array(z.number().int().min(0)).optional(),
    questionImage: z.string().url().optional(),
    optionImages: z.array(z.string().url().optional()).optional(),
  })
  .strict();

export const createBookmarkRequestSchema = z
  .object({
    quiz: z
      .object({
        slug: z.string().trim().min(1),
        title: z.string().trim().min(1),
        description: z.string().trim().optional(),
      })
      .strict(),
    question: bookmarkQuestionSchema,
    questionIndex: z.number().int().min(0),
  })
  .strict();

export interface BookmarkDto {
  id: string;
  quiz: {
    slug: string;
    title: string;
    description?: string;
  };
  question: z.infer<typeof bookmarkQuestionSchema>;
  questionIndex: number;
  createdAt: string;
  updatedAt?: string;
}

export interface BookmarkListDto {
  bookmarks: BookmarkDto[];
  pagination: PaginationMeta;
}

export type BookmarkListQueryDto = z.infer<typeof bookmarkListQuerySchema>;
export type CreateBookmarkRequestDto = z.infer<typeof createBookmarkRequestSchema>;
