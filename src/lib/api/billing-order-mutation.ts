import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { billingOrderParamsSchema } from '@/dtos/billing';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';

/** Every admin order mutation names the order it acts on, in the body as well. */
interface BillingOrderMutationBody {
  readonly orderId: string;
}

/**
 * The scaffolding every operator-driven money mutation needs, in one place.
 *
 * Each of these routes is a hand on the ledger: the mutation guard, the route
 * id, the body schema and the cross-check that the two name the same order all
 * have to hold before anything is recorded, and an operator's identity has to
 * ride along into the write. Restating that per route is how one of them
 * quietly ends up missing a guard, so the route is left with only the part
 * that differs — which schema, which port call, which error scope.
 *
 * Validation goes through `parseParamsAndBody`, the same parser
 * `withCommunicationMutation` uses, so a 400 from either wrapper carries the
 * same `{ fields }` payload that drives field-level highlighting in the client.
 * The order-identity cross-check below is the one thing the shared parser cannot
 * express: it is a relation between two schemas, not a rule inside either.
 */
export function withBillingOrderMutation<TBody extends BillingOrderMutationBody, TResult>(
  schema: ZodType<TBody>,
  errorScope: string,
  record: (input: TBody, recordedBy: string) => Promise<TResult>,
): ReturnType<typeof withAdmin<{ orderId: string }>> {
  return withAdmin<{ orderId: string }>(
    async (request: NextRequest, { userId, params }): Promise<Response> => {
      try {
        assertBillingMutationRequest(request);
        const parsed = await parseParamsAndBody(request, params, {
          params: billingOrderParamsSchema,
          body: schema,
        });
        if (!parsed.ok) return parsed.response;
        if (parsed.body.orderId !== parsed.params.orderId) {
          return apiErr('validation_error', 'Order ID does not match route', 400);
        }
        return apiOk(await record(parsed.body, userId));
      } catch (error) {
        return billingHttpError(error, errorScope);
      }
    },
  );
}
