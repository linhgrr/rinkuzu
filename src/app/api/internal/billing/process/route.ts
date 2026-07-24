import type { NextRequest } from 'next/server';
import { apiOk } from '@/lib/api/response';
import { createBillingService } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertInternalBillingRequest } from '@/services/billing/billing-security';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const service = createBillingService();
    await assertInternalBillingRequest(request, (nonce, expiresAt) =>
      service.consumeInternalNonce(nonce, expiresAt),
    );
    return apiOk(await service.processInbox());
  } catch (error) {
    return billingHttpError(error, 'process-inbox');
  }
}
