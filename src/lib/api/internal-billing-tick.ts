import type { NextRequest } from 'next/server';
import { apiOk } from '@/lib/api/response';
import { createBillingService, createInternalNonceRepository } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertInternalBillingRequest, internalTickId } from '@/services/billing/billing-security';

/**
 * The scaffolding both scheduler endpoints need, in one place.
 *
 * Each of them is an unauthenticated URL that drains money-moving queues, so
 * the HMAC check and the single-use nonce are the entire boundary. Restating
 * them per route is how one of them eventually ships without the nonce and
 * becomes replayable, so the route is left with only the part that differs:
 * which drain, and what is worth logging about it.
 *
 * The tick id is handed in rather than derived again inside each route,
 * because the whole point of it is that the scheduler's log line and the
 * drain's log lines carry the same one.
 */
type BillingServiceInstance = ReturnType<typeof createBillingService>;

export function withInternalBillingTick<T>(
  errorScope: string,
  run: (service: BillingServiceInstance, tickId: string) => Promise<T>,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const nonces = createInternalNonceRepository();
      await assertInternalBillingRequest(request, (nonce, expiresAt) =>
        nonces.consumeInternalNonce(nonce, expiresAt),
      );
      return apiOk(await run(createBillingService(), internalTickId(request)));
    } catch (error) {
      return billingHttpError(error, errorScope);
    }
  };
}
