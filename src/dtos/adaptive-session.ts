import { z } from 'zod';
import type { components } from '@/generated/adaptive-api';
import { routePathSegmentSchema } from '@/lib/validation/common';

type ApiSchemas = components['schemas'];

const adaptiveSessionGetActionSchema = z.enum(['theory', 'status', 'graph', 'mastery-matrix']);
const adaptiveSessionPostActionSchema = z.enum(['next-concept', 'exercise', 'step', 'submit']);

export const adaptiveSessionGetPathParamsSchema = z
  .strictObject({
    path: z.union([
      z.tuple([routePathSegmentSchema, adaptiveSessionGetActionSchema]),
      z.tuple([routePathSegmentSchema, z.literal('concept'), routePathSegmentSchema]),
    ]),
  })
  .transform(({ path }) => ({
    sessionId: path[0],
    action: path[1],
    conceptId: path[1] === 'concept' ? path[2] : undefined,
  }));

export const adaptiveSessionPostPathParamsSchema = z
  .strictObject({
    path: z.tuple([routePathSegmentSchema, adaptiveSessionPostActionSchema]),
  })
  .transform(({ path }) => ({
    sessionId: path[0],
    action: path[1],
  }));

const submitAnswerPayloadSchema = z
  .strictObject({
    choice: z.string().nullable().optional(),
    choices: z.array(z.string()).optional(),
    boolean: z.boolean().nullable().optional(),
    blanks: z.array(z.string()).optional(),
    ordering: z.array(z.string()).optional(),
    matching: z.record(z.string(), z.string()).optional(),
    text: z.string().nullable().optional(),
  })
  .transform((answer): ApiSchemas['SubmitAnswerPayload'] => ({
    ...(answer.choice !== undefined ? { choice: answer.choice } : {}),
    ...(answer.choices !== undefined ? { choices: answer.choices } : {}),
    ...(answer.boolean !== undefined ? { boolean: answer.boolean } : {}),
    ...(answer.blanks !== undefined ? { blanks: answer.blanks } : {}),
    ...(answer.ordering !== undefined ? { ordering: answer.ordering } : {}),
    ...(answer.matching !== undefined ? { matching: answer.matching } : {}),
    ...(answer.text !== undefined ? { text: answer.text } : {}),
  }));

export const adaptiveSubmitAnswerRequestSchema: z.ZodType<ApiSchemas['SubmitAnswerRequest']> =
  z.strictObject({
    exercise_id: z.string().min(1),
    idempotency_key: z.string().min(1).max(128),
    answer: submitAnswerPayloadSchema,
  });
