import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { addAdminUserCreditsRequestSchema, adminUserIdRouteParamsSchema } from '@/dtos/admin-user';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { logger } from '@/lib/logger';
import { premiumQuizErrorResponse, PREMIUM_PRIVATE_HEADERS } from '@/lib/api/premium-quiz';

export const dynamic = 'force-dynamic';

export const POST = withAdmin<{ userId: string }>(async (request: NextRequest, context) => {
  try {
    if (!context.userId) {
      return apiErr('validation_error', 'Admin identity is required', 400);
    }
    const parsedParams = readAndValidateRouteParams(context.params, adminUserIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, {
        fields: parsedParams.fields,
      });
    }
    const input = await readAndValidateJson(request, addAdminUserCreditsRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }
    const result = await getPremiumQuizService().grantAdminCredits({
      userId: parsedParams.data.userId,
      adminUserId: context.userId,
      amount: input.data.amount,
      note: input.data.note,
      idempotencyKey: input.data.idempotencyKey,
    });
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Admin credit grant failed');
    return premiumQuizErrorResponse(error);
  }
});
