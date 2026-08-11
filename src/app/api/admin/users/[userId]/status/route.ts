import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
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

    const parsedParams = readAndValidateRouteParams(context.params, adminUserIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, {
        fields: parsedParams.fields,
      });
    }

    const input = await readAndValidateJson(request, updateAdminUserStatusRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminService.setUserDisable(parsedParams.data.userId, input.data.disable, {
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
