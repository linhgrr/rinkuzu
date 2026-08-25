import { NextRequest } from 'next/server';
import { createEntitlementService } from '@/lib/entitlement-factory';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    const status = await createEntitlementService().getStatus(userId);

    return apiOk(status, 200, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching subscription status');
    return apiErr('internal_error', 'Failed to fetch subscription status', 500);
  }
});
