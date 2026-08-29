import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  adminUserIdRouteParamsSchema,
  updateAdminUserStatusRequestSchema,
} from '@/dtos/admin-user';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const adminService = getAdminService();

// PATCH /api/admin/users/[userId]/status — atomic soft-disable / restore
export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    if (!context.email || !context.userId) {
      return apiErr('validation_error', 'Admin identity is required', 400);
    }

    const parsed = await parseParamsAndBody(request, context.params, {
      params: adminUserIdRouteParamsSchema,
      body: updateAdminUserStatusRequestSchema,
    });
    if (!parsed.ok) return parsed.response;

    const result = await adminService.setUserDisable(parsed.params.userId, parsed.body.disable, {
      id: context.userId,
      email: context.email,
    });

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data, 200, { meta: { message: result.data.message } });
  } catch (error: unknown) {
    logger.error({ error }, 'Update user status error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
