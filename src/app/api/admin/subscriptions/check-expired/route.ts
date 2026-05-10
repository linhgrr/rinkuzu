import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSubscriptionService } from '@/lib/subscriptionFactory';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const cronSecret = process.env['SUBSCRIPTION_CRON_SECRET'];
    const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const hasValidCronToken = Boolean(cronSecret && bearerToken === cronSecret);

    if (!hasValidCronToken && (!session?.user || (session.user as any).role !== 'admin')) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 },
      );
    }

    // Get subscription service
    const subscriptionService = createSubscriptionService();

    // Check and update expired subscriptions
    const updatedCount = await subscriptionService.checkAndUpdateExpiredSubscriptions();

    return NextResponse.json({
      success: true,
      message: 'Expired subscriptions checked and updated successfully',
      data: { updatedCount },
    });
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to check expired subscriptions',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
