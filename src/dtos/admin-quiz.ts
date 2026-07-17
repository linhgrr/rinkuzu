import { z } from 'zod';
import type { PaginationMeta } from '@/dtos/common';
import type { QuizQuestionDto } from '@/dtos/quiz';
import { objectIdSchema } from '@/lib/validation/common';

const adminQuizVisibilitySchema = z.enum(['all', 'public', 'private']);

export const adminQuizListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(200).optional(),
  visibility: adminQuizVisibilitySchema.default('all'),
});

export const adminQuizIdParamsSchema = z.object({
  id: objectIdSchema,
});

export interface AdminQuizAuthorDto {
  id: string;
  email?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
}

type AdminQuizQuestionDto = QuizQuestionDto;

export interface AdminQuizListItemDto {
  id: string;
  title: string;
  description?: string;
  slug: string;
  author: AdminQuizAuthorDto;
  folder?: string | null;
  isPrivate: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizDetailDto extends AdminQuizListItemDto {
  questions: AdminQuizQuestionDto[];
  pdfUrl?: string;
  tags?: string[];
}

export interface AdminQuizListDto {
  quizzes: AdminQuizListItemDto[];
  pagination: PaginationMeta;
}

export type AdminQuizListQueryDto = z.infer<typeof adminQuizListQuerySchema>;
