import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const doCheckExpired = async () => {
  const subscriptionService = createSubscriptionService();
  const updatedCount = await subscriptionService.checkAndUpdateExpiredSubscriptions();
  return apiOk({ updatedCount }, 200, {
    meta: { message: 'Expired subscriptions checked and updated successfully' },
  });
};

const adminHandler = withAdmin(async () => doCheckExpired());

function bearerMatchesCronSecret(bearerToken: string, cronSecret: string): boolean {
  const tokenBytes = Buffer.from(bearerToken);
  const secretBytes = Buffer.from(cronSecret);
  if (tokenBytes.byteLength !== secretBytes.byteLength) {
    return false;
  }
  return timingSafeEqual(tokenBytes, secretBytes);
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = env.SUBSCRIPTION_CRON_SECRET;
    const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (cronSecret && bearerToken && bearerMatchesCronSecret(bearerToken, cronSecret)) {
      return doCheckExpired();
    }

    return adminHandler(request, { params: Promise.resolve({}) });
  } catch (error: unknown) {
    logger.error({ error }, 'Error checking expired subscriptions');
    return apiErr('internal_error', 'Failed to check expired subscriptions', 500);
  }
}
