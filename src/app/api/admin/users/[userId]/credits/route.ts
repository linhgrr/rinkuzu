import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
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
    const parsed = await parseParamsAndBody(request, context.params, {
      params: adminUserIdRouteParamsSchema,
      body: addAdminUserCreditsRequestSchema,
    });
    if (!parsed.ok) return parsed.response;
    const result = await getPremiumQuizService().grantAdminCredits({
      userId: parsed.params.userId,
      adminUserId: context.userId,
      amount: parsed.body.amount,
      note: parsed.body.note,
      idempotencyKey: parsed.body.idempotencyKey,
    });
    return apiOk(result, 200, { headers: PREMIUM_PRIVATE_HEADERS });
  } catch (error) {
    logger.error({ error }, 'Admin credit grant failed');
    return premiumQuizErrorResponse(error);
  }
});
