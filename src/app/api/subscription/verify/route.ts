import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAuth } from '@/lib/api/auth';
import { apiOk, apiErr } from '@/lib/api/response';
import { extractUnknownErrorMessage } from '@/lib/api/error';
import { logger } from '@/lib/logger';
import { readAndValidateJson } from '@/lib/api/request';
import { verifySubscriptionRequestSchema } from '@/dtos/subscription';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const input = await readAndValidateJson(request, verifySubscriptionRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, input.fields);
    }

    const subscriptionService = createSubscriptionService();
    const numericOrderCode =
      typeof input.data.orderCode === 'string'
        ? Number.parseInt(input.data.orderCode, 10)
        : input.data.orderCode;

    // Entitlement cache invalidation happens inside the activation service so
    // verify and webhook paths share one boundary after durable success.
    const result = await subscriptionService.verifyAndActivateSubscription(
      numericOrderCode,
      userId,
    );

    return apiOk(result);
  } catch (error: unknown) {
    logger.error({ error }, 'Error verifying payment');
    return apiErr(
      'internal_error',
      extractUnknownErrorMessage(error, 'Failed to verify payment'),
      500,
    );
  }
});
