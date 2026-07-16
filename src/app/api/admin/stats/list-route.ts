import type { NextRequest } from 'next/server';

import type { AdminStatsListQueryDto } from '@/dtos/admin-stats';
import { adminStatsListQuerySchema } from '@/dtos/admin-stats';
import type { ServiceResult } from '@/interfaces/services/types';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

interface AdminStatsListRouteOptions<TData, TResponse> {
  load: (query: AdminStatsListQueryDto) => Promise<ServiceResult<TData>>;
  mapData: (data: TData, query: AdminStatsListQueryDto) => TResponse;
  logMessage: string;
  publicErrorMessage: string;
}

export function createAdminStatsListRoute<TData, TResponse>(
  options: AdminStatsListRouteOptions<TData, TResponse>,
) {
  return withAdmin(async (request: NextRequest) => {
    try {
      const query = readAndValidateSearchParams(request, adminStatsListQuerySchema);
      if (!query.success) {
        return apiErr('validation_error', query.error, 400, { fields: query.fields });
      }

      const result = await options.load(query.data);
      if (!result.success) {
        return apiServiceErr(result);
      }

      return apiOk(options.mapData(result.data, query.data));
    } catch (error) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', options.publicErrorMessage, 500);
    }
  });
}
