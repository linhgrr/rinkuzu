import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (_request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Subscription id is required', 400);
    }

    const subscriptionService = createSubscriptionService();

    // Get all subscription history and find the specific one
    const allSubscriptions = await subscriptionService.getSubscriptionHistory('');
    const subscription = allSubscriptions.find((sub) => sub.id === id);

    if (!subscription) {
      return apiErr('not_found', 'Subscription not found', 404);
    }

    return apiOk(subscription);
  } catch (error: unknown) {
    logger.error({ error }, 'Admin subscription detail error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Subscription id is required', 400);
    }

    const body = await request.json();
    const subscriptionService = createSubscriptionService();
    const result = await subscriptionService.updateSubscriptionById(id, body);
    if (!result.success) {
      return apiServiceErr(result, 400);
    }
    return apiOk(result.data);
  } catch (error: unknown) {
    logger.error({ error }, 'Admin subscription update error');
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = PATCH;
