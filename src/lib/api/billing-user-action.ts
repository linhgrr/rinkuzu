import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { billingOrderParamsSchema } from '@/dtos/billing';
import { withAuth } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { parseJsonBody, parseRouteParams } from '@/lib/api/validated';
import { consumeBillingRateLimit, type BillingRateLimitAction } from '@/lib/billing-rate-limit';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';

/**
 * What a billing action hands back: its payload, and the status when 200 is the
 * wrong answer — creating an order can return 200 for an idempotent replay or
 * 201 for a genuinely new row, and the route is the only place that knows which.
 */
export interface BillingActionResult<TData> {
  readonly data: TData;
  readonly status?: number;
}

/**
 * The scaffolding every customer-initiated billing write needs, in one place.
 *
 * Unlike the operator routes, these are reachable by anyone with a session, so
 * two things have to hold before money logic runs and neither is visible in the
 * response when it is missing: the same-origin double-submit guard, and the
 * per-user rate limit that stops one account from minting orders in a loop. A
 * route that forgets either still returns 200 on the happy path, which is
 * exactly why they are stated here once instead of per route.
 *
 * The read route on the same path deliberately does NOT use this: a GET takes
 * no guard and no rate-limit budget, and forcing it through here would quietly
 * give it both.
 */
export function withBillingUserOrderAction<TData>(
  rateLimitAction: BillingRateLimitAction,
  errorScope: string,
  run: (userId: string, orderId: string) => Promise<BillingActionResult<TData>>,
): ReturnType<typeof withAuth<{ orderId: string }>> {
  return withAuth<{ orderId: string }>(
    async (request: NextRequest, { userId, params }): Promise<Response> => {
      try {
        assertBillingMutationRequest(request);
        await consumeBillingRateLimit(rateLimitAction, userId);
        const parsed = parseRouteParams(params, billingOrderParamsSchema);
        if (!parsed.ok) return parsed.response;
        const result = await run(userId, parsed.data.orderId);
        return apiOk(result.data, result.status ?? 200);
      } catch (error) {
        return billingHttpError(error, errorScope);
      }
    },
  );
}

/** The same contract for the writes that name their subject in the body. */
export function withBillingUserBodyAction<TBody, TData>(
  schema: ZodType<TBody>,
  rateLimitAction: BillingRateLimitAction,
  errorScope: string,
  run: (userId: string, body: TBody, request: NextRequest) => Promise<BillingActionResult<TData>>,
): ReturnType<typeof withAuth> {
  return withAuth(async (request: NextRequest, { userId }): Promise<Response> => {
    try {
      assertBillingMutationRequest(request);
      await consumeBillingRateLimit(rateLimitAction, userId);
      const parsed = await parseJsonBody(request, schema);
      if (!parsed.ok) return parsed.response;
      const result = await run(userId, parsed.data, request);
      return apiOk(result.data, result.status ?? 200);
    } catch (error) {
      return billingHttpError(error, errorScope);
    }
  });
}
