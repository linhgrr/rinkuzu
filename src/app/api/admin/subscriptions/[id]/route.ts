import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAdmin(async (_request: NextRequest, context) => {
  try {
    const rawId = context.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      return apiErr('validation_error', 'Subscription id is required', 400);
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();

    // Get all subscription history and find the specific one
    const allSubscriptions = await subscriptionService.getSubscriptionHistory('');
    const subscription = allSubscriptions.find((sub) => sub.id === id);

    if (!subscription) {
      return apiErr('not_found', 'Subscription not found', 404);
    }

    return NextResponse.json({ success: true, data: subscription });
  } catch (error: unknown) {
    console.error('Admin subscription detail error:', error);
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
    const subscriptionService = ServiceFactory.createSubscriptionService();
    const result = await subscriptionService.updateSubscriptionById(id, body);
    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', 400);
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    console.error('Admin subscription update error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
});

export const PUT = PATCH;
