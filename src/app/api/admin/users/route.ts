import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { getAdminService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { grantUserSubscriptionRequestSchema } from '@/dtos/admin-billing';
import { getAdminSubscriptionService } from '@/lib/admin-subscription-factory';
import { logger } from '@/lib/logger';
import { adminUserListQuerySchema, updateAdminUserRoleRequestSchema } from '@/dtos/admin-user';

const adminService = getAdminService();
const adminSubscriptionService = getAdminSubscriptionService();

// GET /api/admin/users - List users with filtering (admin-inclusive disable status)
export const GET = withAdmin(async (request: NextRequest) => {
  const query = readAndValidateSearchParams(request, adminUserListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await adminService.getUsers(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

// PATCH /api/admin/users - Update user role
export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const input = await readAndValidateJson(request, updateAdminUserRoleRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminService.updateUserRole(input.data.userId, input.data.role, {
      id: context.userId,
      email: context.email,
    });

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Update user role error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// POST /api/admin/users - Add subscription to user
export const POST = withAdmin(async (request: NextRequest) => {
  const input = await readAndValidateJson(request, grantUserSubscriptionRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const result = await adminSubscriptionService.grantUserSubscription(input.data);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Subscription added successfully' } })
    : apiServiceErr(result);
});
