import { z } from 'zod';
import type { components } from '@/generated/adaptive-api';
import { routePathSegmentSchema } from '@/lib/validation/common';

type ApiSchemas = components['schemas'];

const adaptiveSessionGetActionSchema = z.enum(['theory', 'status', 'graph', 'mastery-matrix']);
const adaptiveSessionPostActionSchema = z.enum(['next-concept', 'exercise', 'submit', 'chat']);

export const adaptiveSessionGetPathParamsSchema = z
  .object({
    path: z.union([
      z.tuple([routePathSegmentSchema, adaptiveSessionGetActionSchema]),
      z.tuple([routePathSegmentSchema, z.literal('concept'), routePathSegmentSchema]),
    ]),
  })
  .strict()
  .transform(({ path }) => ({
    sessionId: path[0],
    action: path[1],
    conceptId: path[1] === 'concept' ? path[2] : undefined,
  }));

export const adaptiveSessionPostPathParamsSchema = z
  .object({
    path: z.tuple([routePathSegmentSchema, adaptiveSessionPostActionSchema]),
  })
  .strict()
  .transform(({ path }) => ({
    sessionId: path[0],
    action: path[1],
  }));

const submitAnswerPayloadSchema = z
  .object({
    choice: z.string().nullable().optional(),
    choices: z.array(z.string()).optional(),
    boolean: z.boolean().nullable().optional(),
    blanks: z.array(z.string()).optional(),
    ordering: z.array(z.string()).optional(),
    matching: z.record(z.string(), z.string()).optional(),
    text: z.string().nullable().optional(),
  })
  .strict();

export const adaptiveSubmitAnswerRequestSchema: z.ZodType<ApiSchemas['SubmitAnswerRequest']> = z
  .object({
    answer: submitAnswerPayloadSchema,
  })
  .strict();

const tutorChatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(4000),
  })
  .strict();

export const adaptiveTutorChatRequestSchema: z.ZodType<ApiSchemas['TutorChatRequest']> = z
  .object({
    userQuestion: z.string().min(1).max(1000),
    chatHistory: z.array(tutorChatMessageSchema).optional(),
    stream: z.boolean().default(false),
  })
  .strict();
