import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAuth } from '@/lib/api/auth';
import { createPaymentRequestSchema } from '@/dtos/admin-billing';
import { apiErr, apiOk } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { logger } from '@/lib/logger';
import { billingConfig } from '@/services/billing/billing-config';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    if (!billingConfig.payosCreateEnabled()) {
      return apiErr('payment_creation_disabled', 'Payment creation is temporarily paused', 503);
    }
    const input = await readAndValidateJson(request, createPaymentRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const subscriptionService = createSubscriptionService();
    const paymentData = await subscriptionService.createPaymentRequest(userId, input.data.planId);

    return apiOk(paymentData);
  } catch (error: unknown) {
    logger.error({ error }, 'Error creating payment request');
    const message = error instanceof Error ? error.message : 'Failed to create payment request';
    if (message === 'Invalid subscription plan') {
      return apiErr('validation_error', 'Invalid plan ID', 400);
    }
    return apiErr('internal_error', message, 500);
  }
});
