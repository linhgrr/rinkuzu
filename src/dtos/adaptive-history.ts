import { z } from 'zod';
import { routePathSegmentSchema } from '@/lib/validation/common';

export const adaptiveHistoryGetPathParamsSchema = z
  .object({
    path: z.union([
      z.tuple([z.literal('subjects'), z.literal('progress')]),
      z.tuple([z.literal('subjects'), routePathSegmentSchema]),
    ]),
  })
  .strict()
  .transform(({ path }) =>
    path[1] === 'progress'
      ? { kind: 'progress' as const }
      : { kind: 'subject' as const, jobId: path[1] },
  );

export const adaptiveHistoryDeletePathParamsSchema = z
  .object({
    path: z.tuple([z.literal('subjects'), routePathSegmentSchema]),
  })
  .strict()
  .transform(({ path }) => ({ jobId: path[1] }));

export const adaptiveHistoryProgressQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
  })
  .strict();

export const adaptiveHistorySubjectQuerySchema = z.object({}).strict();

export const adaptiveHistoryDeleteQuerySchema = z
  .object({
    delete_sessions: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .strict();
