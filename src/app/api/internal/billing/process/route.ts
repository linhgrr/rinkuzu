import type { NextRequest } from 'next/server';
import { apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { logger } from '@/lib/logger';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertInternalBillingRequest } from '@/services/billing/billing-security';

// The drain calls the payment provider once per queued event, so it needs more
// than the platform default. Must stay above the repository's batch budget.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const service = createBillingService();
    await assertInternalBillingRequest(request, (nonce, expiresAt) =>
      service.consumeInternalNonce(nonce, expiresAt),
    );
    const result = await service.processInbox();
    if (result.exhaustedBudget) {
      logger.warn({ ...result }, 'Payment webhook inbox drain stopped on its time budget');
    }
    return apiOk(result);
  } catch (error) {
    return billingHttpError(error, 'process-inbox');
  }
}
