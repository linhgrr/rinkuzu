import type { ServiceResult } from '@/interfaces/services/types';
import {
  adminQuizIdParamsSchema,
  adminQuizVisibilityBodySchema,
  type AdminQuizVisibilityBodyDto,
} from '@/dtos/admin-quiz';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';

interface AdminQuizIdRouteOptions<TData> {
  execute: (id: string) => Promise<ServiceResult<TData>>;
  successMeta?: Record<string, unknown>;
}

export function createAdminQuizIdRoute<TData>(options: AdminQuizIdRouteOptions<TData>) {
  return withAdmin<{ id: string }>(async (_request, { params }) => {
    const parsedParams = parseRouteParams(params, adminQuizIdParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const result = await options.execute(parsedParams.data.id);
    return result.success
      ? apiOk(result.data, 200, options.successMeta ? { meta: options.successMeta } : undefined)
      : apiServiceErr(result);
  });
}

interface AdminQuizVisibilityRouteOptions<TData> {
  execute: (
    id: string,
    visibility: AdminQuizVisibilityBodyDto['visibility'],
    actor: { id: string; email: string },
  ) => Promise<ServiceResult<TData>>;
}

/**
 * PATCH body `{ visibility }`. Admin-only; the proxy's same-origin guard covers
 * CSRF for every state-changing /api request before this runs.
 */
export function createAdminQuizVisibilityRoute<TData>(
  options: AdminQuizVisibilityRouteOptions<TData>,
) {
  return withAdmin<{ id: string }>(async (request, { params, userId, email }) => {
    const parsed = await parseParamsAndBody(request, params, {
      params: adminQuizIdParamsSchema,
      body: adminQuizVisibilityBodySchema,
    });
    if (!parsed.ok) return parsed.response;

    const result = await options.execute(parsed.params.id, parsed.body.visibility, {
      id: userId,
      email,
    });
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  });
}

interface AdminQuizActorRouteOptions<TData> {
  execute: (id: string, actor: { id: string; email: string }) => Promise<ServiceResult<TData>>;
}

/**
 * Bodyless admin action on one quiz, run as the signed-in admin so the service
 * can audit it (RIN-1342 Clear flag). The proxy's same-origin guard covers CSRF.
 */
export function createAdminQuizActorRoute<TData>(options: AdminQuizActorRouteOptions<TData>) {
  return withAdmin<{ id: string }>(async (_request, { params, userId, email }) => {
    const parsedParams = parseRouteParams(params, adminQuizIdParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    const result = await options.execute(parsedParams.data.id, { id: userId, email });
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  });
}
