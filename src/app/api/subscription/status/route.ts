import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    const subscriptionService = ServiceFactory.createSubscriptionService();
    const subscription = await subscriptionService.getUserSubscription((session.user as any).id);
    const isPremium = await subscriptionService.isUserPremium((session.user as any).id);

    return apiOk(
      {
        subscription: isPremium ? subscription : null,
        isPremium,
      },
      200,
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
