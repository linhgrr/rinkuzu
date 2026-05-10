import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSubscriptionService } from '@/lib/subscriptionFactory';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const subscriptionService = createSubscriptionService();
    const subscription = await subscriptionService.getUserSubscription((session.user as any).id);
    const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

    return NextResponse.json(
      {
        success: true,
        data: {
          subscription: isPremium ? subscription : null,
          isPremium,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return apiErr('internal_error', 'Failed to fetch subscription status', 500);
  }
}
