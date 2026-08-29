import type { NextRequest } from 'next/server';
import { adminWebhookRowParamsSchema } from '@/dtos/admin-billing-orders';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createWebhookOperationDeps } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import type { WebhookOperationDeps } from '@/services/billing/webhooks/webhook-operations';

/**
 * The scaffolding both operator actions on a webhook row need.
 *
 * These are the most sensitive rows billing keeps: one hands back
 * attacker-controlled provider text that may name a payer, the other puts a
 * delivery back into settlement. The admin session, the same-origin token, the
 * row id and the operator's identity riding into the audit trail all have to
 * hold before either runs, so they are stated once rather than once per route.
 */
interface WebhookRowOperator {
  readonly id: string;
  readonly email: string;
}

export function withWebhookRowAction<T>(
  errorScope: string,
  run: (
    deps: WebhookOperationDeps,
    command: { inboxRef: string; operator: WebhookRowOperator },
  ) => Promise<T>,
  headers?: Record<string, string>,
): ReturnType<typeof withAdmin<{ inboxId: string }>> {
  return withAdmin<{ inboxId: string }>(
    async (request: NextRequest, { userId, email, params }): Promise<Response> => {
      try {
        assertBillingMutationRequest(request);
        const route = readAndValidateRouteParams(params, adminWebhookRowParamsSchema);
        if (!route.success) {
          return apiErr('validation_error', route.error, 400, { fields: route.fields });
        }
        const result = await run(createWebhookOperationDeps(), {
          inboxRef: route.data.inboxId,
          operator: { id: userId, email },
        });
        return apiOk(result, 200, headers ? { headers } : {});
      } catch (error) {
        return billingHttpError(error, errorScope);
      }
    },
  );
}
