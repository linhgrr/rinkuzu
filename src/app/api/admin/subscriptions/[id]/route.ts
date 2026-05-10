import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSubscriptionService } from '@/lib/subscriptionFactory';
import { AsyncRouteParams } from '@/types/next-route';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const subscriptionService = createSubscriptionService();

    // Get all subscription history and find the specific one
    const allSubscriptions = await subscriptionService.getSubscriptionHistory('');
    const subscription = allSubscriptions.find((sub: any) => sub._id.toString() === id);

    if (!subscription) {
      return apiErr('not_found', 'Subscription not found', 404);
    }

    return NextResponse.json({ success: true, data: subscription });
  } catch (error: any) {
    console.error('Admin subscription detail error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

export async function PATCH(request: NextRequest, { params }: AsyncRouteParams<{ id: string }>) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return apiErr('forbidden', 'Admin access required', 403);
    }

    const body = await request.json();
    const subscriptionService = createSubscriptionService();
    const result = await subscriptionService.updateSubscriptionById(id, body);
    if (!result.success) {
      return apiErr('service_error', result.error ?? 'Request failed', 400);
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Admin subscription update error:', error);
    return apiErr('internal_error', 'Internal server error', 500);
  }
}

export const PUT = PATCH;
