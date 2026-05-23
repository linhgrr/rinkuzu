import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import Plan from '@/models/Plan';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const { planId } = await request.json();

    if (!planId) {
      return apiErr('validation_error', 'Plan ID is required', 400);
    }

    // Verify plan exists in database
    await connectDB();
    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return apiErr('validation_error', 'Invalid plan ID', 400);
    }

    const subscriptionService = createSubscriptionService();
    const paymentData = await subscriptionService.createPaymentRequest(userId, planId);

    return apiOk(paymentData);
  } catch (error: unknown) {
    logger.error({ error }, 'Error creating payment request');
    const message = error instanceof Error ? error.message : 'Failed to create payment request';
    return apiErr('internal_error', message, 500);
  }
});
