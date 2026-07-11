import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid object id');
export const positivePageSchema = z.coerce.number().int().min(1);

export const routePathSegmentSchema = z
  .string()
  .trim()
  .min(1, 'Route parameter is required')
  .refine((value) => value !== 'undefined' && value !== 'null', 'Route parameter is required')
  .refine((value) => value !== '.' && value !== '..', 'Route parameter is required')
  .refine((value) => !value.includes('/'), 'Route parameter must be a single path segment')
  .regex(/^[A-Za-z0-9._~-]+$/, 'Route parameter contains unsafe characters');

export const slugRouteParamSchema = routePathSegmentSchema.regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Invalid slug',
);

export const objectIdRouteParamSchema = objectIdSchema.and(routePathSegmentSchema);
