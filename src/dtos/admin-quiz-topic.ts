import { z } from 'zod';
import { objectIdSchema } from '@/lib/validation/common';
import { QUIZ_TOPIC_LOCALES, QUIZ_TOPIC_SLUG_PATTERN } from '@/shared/constants/quiz-topic';

const topicSlugSchema = z.string().trim().min(2).max(80).regex(QUIZ_TOPIC_SLUG_PATTERN);
const topicNameSchema = z.string().trim().min(2).max(120);
// Generous cap: the 120–400 word rule is checked on publish, not here.
const topicIntroSchema = z.string().max(6000);
const positionSchema = z.number().int().min(1).max(1000);

export const adminQuizTopicIdParamsSchema = z.object({ id: objectIdSchema });
export const adminQuizTopicQuizParamsSchema = z.object({
  id: objectIdSchema,
  quizId: objectIdSchema,
});

/** POST: create a draft topic (published topics are created by a later PATCH). */
export const adminQuizTopicCreateBodySchema = z
  .object({
    slug: topicSlugSchema,
    locale: z.enum(QUIZ_TOPIC_LOCALES).default('vi'),
    name: topicNameSchema,
    intro: topicIntroSchema.default(''),
    order: positionSchema.optional(),
  })
  .strict();

export type AdminQuizTopicCreateBodyDto = z.infer<typeof adminQuizTopicCreateBodySchema>;

/** PATCH: edit fields, publish or unpublish. Publishing needs a 120–400 word intro. */
export const adminQuizTopicUpdateBodySchema = z
  .object({
    slug: topicSlugSchema.optional(),
    name: topicNameSchema.optional(),
    intro: topicIntroSchema.optional(),
    order: positionSchema.optional(),
    published: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Provide at least one field',
  });

export type AdminQuizTopicUpdateBodyDto = z.infer<typeof adminQuizTopicUpdateBodySchema>;

/** POST …/quizzes: assign a public quiz; `order` is a 1-based position, default last. */
export const adminQuizTopicAssignBodySchema = z
  .object({ quizId: objectIdSchema, order: positionSchema.optional() })
  .strict();

export type AdminQuizTopicAssignBodyDto = z.infer<typeof adminQuizTopicAssignBodySchema>;

/** PATCH …/quizzes/[quizId]: move the quiz to a 1-based position in the topic. */
export const adminQuizTopicReorderBodySchema = z.object({ order: positionSchema }).strict();

export type AdminQuizTopicReorderBodyDto = z.infer<typeof adminQuizTopicReorderBodySchema>;

export interface AdminQuizTopicItemDto {
  id: string;
  slug: string;
  locale: string;
  name: string;
  intro: string;
  introWords: number;
  order: number;
  published: boolean;
  quizCount: number;
}

export interface AdminQuizTopicListDto {
  items: AdminQuizTopicItemDto[];
}

interface AdminQuizTopicQuizDto {
  quizId: string;
  order: number;
  /** Null only when the quiz no longer exists. */
  slug: string | null;
  title: string | null;
  questionCount: number;
  /** False when the owner has made the quiz private since it was assigned. */
  isPublic: boolean;
}

export interface AdminQuizTopicDetailDto {
  topic: AdminQuizTopicItemDto;
  quizzes: AdminQuizTopicQuizDto[];
}
