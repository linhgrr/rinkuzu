import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { ServiceFactory } from '@/lib/serviceFactory';
import { apiErr, apiOk } from '@/lib/api/response';

const doCheckExpired = async () => {
  const subscriptionService = ServiceFactory.createSubscriptionService();
  const updatedCount = await subscriptionService.checkAndUpdateExpiredSubscriptions();
  return apiOk({ updatedCount }, 200, {
    meta: { message: 'Expired subscriptions checked and updated successfully' },
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

    return adminHandler(request, { params: Promise.resolve({}) });
  } catch (error: unknown) {
    console.error('Error checking expired subscriptions:', error);
    return apiErr('internal_error', 'Failed to check expired subscriptions', 500);
  }
}
