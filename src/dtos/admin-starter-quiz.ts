import { z } from 'zod';
import { objectIdSchema } from '@/lib/validation/common';

const adminStarterQuizLocaleSchema = z.enum(['vi', 'en']);
const adminStarterQuizOrderSchema = z.number().int().min(1).max(1000);

export type AdminStarterQuizLocale = z.infer<typeof adminStarterQuizLocaleSchema>;

export const adminStarterQuizIdParamsSchema = z.object({ id: objectIdSchema });

/** POST: mark a quiz as a starter; `order` is a 1-based position, default last. */
export const adminStarterQuizCreateBodySchema = z
  .object({
    quizId: objectIdSchema,
    locale: adminStarterQuizLocaleSchema,
    order: adminStarterQuizOrderSchema.optional(),
  })
  .strict();

export type AdminStarterQuizCreateBodyDto = z.infer<typeof adminStarterQuizCreateBodySchema>;

/** PATCH: change the locale, or move the starter to a 1-based position (the others shift). */
export const adminStarterQuizUpdateBodySchema = z
  .object({
    locale: adminStarterQuizLocaleSchema.optional(),
    order: adminStarterQuizOrderSchema.optional(),
  })
  .strict()
  .refine((body) => body.locale !== undefined || body.order !== undefined, {
    message: 'Provide locale or order',
  });

export type AdminStarterQuizUpdateBodyDto = z.infer<typeof adminStarterQuizUpdateBodySchema>;

export type AdminStarterQuizDropReason = 'missing' | 'not-public' | 'premium' | 'empty';

export interface AdminStarterQuizItemDto {
  /** The starter row id, used in PATCH/DELETE paths. */
  id: string;
  quizId: string;
  /** Null only when the quiz no longer exists. */
  slug: string | null;
  title: string | null;
  /** The quiz's real question count (the dashboard shows a quick round when `quick`). */
  questionCount: number;
  locale: string;
  order: number;
  quick: boolean;
  status: 'live' | 'dropped';
  dropReason?: AdminStarterQuizDropReason;
}

export interface AdminStarterQuizListDto {
  items: AdminStarterQuizItemDto[];
}
