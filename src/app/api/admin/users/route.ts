import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { serviceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { grantUserSubscriptionRequestSchema } from '@/dtos/admin-billing';
import { getAdminBillingService } from '@/lib/admin-billing-factory';
import { logger } from '@/lib/logger';
import {
  adminUserListQuerySchema,
  deleteAdminUserQuerySchema,
  updateAdminUserRoleRequestSchema,
} from '@/dtos/admin-user';

const adminService = serviceFactory.getAdminService();
const adminBillingService = getAdminBillingService();

// GET /api/admin/users - List users with filtering
export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = new URL(request.url).searchParams;
  const query = adminUserListQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    role: searchParams.get('role') ?? undefined,
  });
  if (!query.success) {
    return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid query', 400);
  }

  const result = await adminService.getUsers(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

// PATCH /api/admin/users - Update user role
export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const adminEmail = context.email;
    if (!adminEmail) {
      return apiErr('validation_error', 'Admin email is required', 400);
    }

    const input = await readAndValidateJson(request, updateAdminUserRoleRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminService.updateUserRole(
      input.data.userId,
      input.data.role,
      adminEmail,
    );

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Update user role error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// DELETE /api/admin/users - Delete user
export const DELETE = withAdmin(async (request: NextRequest, context) => {
  try {
    const adminEmail = context.email;
    if (!adminEmail) {
      return apiErr('validation_error', 'Admin email is required', 400);
    }

    const url = new URL(request.url);
    const query = deleteAdminUserQuerySchema.safeParse({
      userId: url.searchParams.get('userId') ?? undefined,
    });
    if (!query.success) {
      return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid user ID', 400);
    }

    const result = await adminService.deleteUser(query.data.userId, adminEmail);

    if (!result.success) {
      return apiServiceErr(result);
    }

    return apiOk(null, 200, { meta: { message: 'User deleted successfully' } });
  } catch (error: unknown) {
    logger.error({ error }, 'Delete user error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

// POST /api/admin/users - Add subscription to user
export const POST = withAdmin(async (request: NextRequest) => {
  const input = await readAndValidateJson(request, grantUserSubscriptionRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const result = await adminBillingService.grantUserSubscription(input.data);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Subscription added successfully' } })
    : apiServiceErr(result);
});
