import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiErr } from '@/lib/api/response';

const doCheckExpired = async () => {
  const subscriptionService = ServiceFactory.createSubscriptionService();
  const updatedCount = await subscriptionService.checkAndUpdateExpiredSubscriptions();
  return NextResponse.json({
    success: true,
    message: 'Expired subscriptions checked and updated successfully',
    data: { updatedCount },
  });
};

const adminHandler = withAdmin(async () => doCheckExpired());

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env['SUBSCRIPTION_CRON_SECRET'];
    const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (cronSecret && bearerToken === cronSecret) {
      return doCheckExpired();
    }

    return adminHandler(request);
  } catch (error) {
    console.error('Error checking expired subscriptions:', error);
    return apiErr('internal_error', 'Failed to check expired subscriptions', 500);
  }
}
