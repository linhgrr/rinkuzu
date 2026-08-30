import type { ServiceResult } from '@/interfaces/services/types';
import { adminQuizIdParamsSchema } from '@/dtos/admin-quiz';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseRouteParams } from '@/lib/api/validated';

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
