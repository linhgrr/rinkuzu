import type { NextRequest } from 'next/server';

import { adminReportIdParamsSchema } from '@/dtos/admin-report';
import { withAdmin } from '@/lib/api/auth';
import { apiErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

interface AdminReportIdRouteContext {
  request: NextRequest;
  id: string;
  userId: string;
  email: string;
}

interface AdminReportIdRouteOptions {
  handle: (context: AdminReportIdRouteContext) => Promise<Response>;
  logMessage: string;
  publicErrorMessage: string;
}

export function createAdminReportIdRoute(options: AdminReportIdRouteOptions) {
  return withAdmin<{ id: string }>(async (request, context) => {
    try {
      const params = adminReportIdParamsSchema.safeParse(context.params);
      if (!params.success) {
        return apiErr(
          'validation_error',
          params.error.issues[0]?.message ?? 'Invalid report ID',
          400,
        );
      }

      return await options.handle({
        request,
        id: params.data.id,
        userId: context.userId,
        email: context.email,
      });
    } catch (error: unknown) {
      logger.error({ error }, options.logMessage);
      return apiErr('internal_error', options.publicErrorMessage, 500);
    }
  });
}
