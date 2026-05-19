import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    const subscriptionService = createSubscriptionService();
    const subscription = await subscriptionService.getUserSubscription(userId);
    const isPremium = await subscriptionService.isUserPremium(userId);

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
});
