import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSubscriptionService } from '@/lib/subscriptionFactory';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
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
    return NextResponse.json(
      { success: false, message: 'Failed to fetch subscription status' },
      { status: 500 },
    );
  }
}
