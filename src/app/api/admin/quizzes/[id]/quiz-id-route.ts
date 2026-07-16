import type { ServiceResult } from '@/interfaces/services/types';
import { adminQuizIdParamsSchema } from '@/dtos/admin-quiz';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';

interface AdminQuizIdRouteOptions<TData> {
  execute: (id: string) => Promise<ServiceResult<TData>>;
  successMeta?: Record<string, unknown>;
}

export function createAdminQuizIdRoute<TData>(options: AdminQuizIdRouteOptions<TData>) {
  return withAdmin<{ id: string }>(async (_request, { params }) => {
    const parsedParams = readAndValidateRouteParams(params, adminQuizIdParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400);
    }

    const result = await options.execute(parsedParams.data.id);
    return result.success
      ? apiOk(result.data, 200, options.successMeta ? { meta: options.successMeta } : undefined)
      : apiServiceErr(result);
  });
}
