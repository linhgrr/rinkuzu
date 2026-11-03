import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { getAdminTestAccountService } from '@/lib/admin-factory';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  adminUserIdRouteParamsSchema,
  updateAdminUserTestAccountRequestSchema,
} from '@/dtos/admin-user';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/users/[userId]/test-account — mark or clear an analytics-excluded test account
export const PATCH = withAdmin(async (request: NextRequest, context) => {
  const { userId: actorId, email: actorEmail } = context;
  if (!actorId || !actorEmail) return apiErr('validation_error', 'Admin identity is required', 400);

  try {
    const input = await parseParamsAndBody(request, context.params, {
      body: updateAdminUserTestAccountRequestSchema,
      params: adminUserIdRouteParamsSchema,
    });
    if (!input.ok) return input.response;

    const result = await getAdminTestAccountService().setTestAccount(
      input.params.userId,
      input.body.isTestAccount,
      { id: actorId, email: actorEmail },
    );
    if (!result.success) return apiServiceErr(result);

    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Update user test account error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
