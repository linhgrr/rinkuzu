import { z } from 'zod';
import { routePathSegmentSchema } from '@/lib/validation/common';

export const adaptiveHistoryGetPathParamsSchema = z
  .strictObject({
    path: z.union([
      z.tuple([z.literal('subjects'), z.literal('progress')]),
      z.tuple([z.literal('subjects'), routePathSegmentSchema]),
    ]),
  })
  .transform(({ path }) =>
    path[1] === 'progress'
      ? { kind: 'progress' as const }
      : { kind: 'subject' as const, jobId: path[1] },
  );

export const adaptiveHistoryDeletePathParamsSchema = z
  .strictObject({
    path: z.tuple([z.literal('subjects'), routePathSegmentSchema]),
  })
  .transform(({ path }) => ({ jobId: path[1] }));

export const adaptiveHistoryProgressQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const adaptiveHistorySubjectQuerySchema = z.strictObject({});

export const adaptiveHistoryDeleteQuerySchema = z.strictObject({
  delete_sessions: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});
