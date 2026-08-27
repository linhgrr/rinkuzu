import type { NextRequest } from 'next/server';
import { apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { logger } from '@/lib/logger';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertInternalBillingRequest } from '@/services/billing/billing-security';

// One provider round trip per due attempt. Must stay above the repository's
// batch budget so the batch, not the platform, decides when to stop.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const service = createBillingService();
    await assertInternalBillingRequest(request, (nonce, expiresAt) =>
      service.consumeInternalNonce(nonce, expiresAt),
    );
    const result = await service.reconcileDueAttempts();
    if (result.exhaustedBudget) {
      logger.warn({ ...result }, 'Payment attempt reconciliation stopped on its time budget');
    }
    return apiOk(result);
  } catch (error) {
    return billingHttpError(error, 'reconcile-attempts');
  }
}
