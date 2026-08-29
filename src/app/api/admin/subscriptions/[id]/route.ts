import { NextRequest } from 'next/server';
import { createEntitlementAdminService } from '@/lib/entitlement-admin-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseParamsAndBody } from '@/lib/api/validated';
import {
  adminSubscriptionIdRouteParamsSchema,
  revokeSubscriptionRequestSchema,
} from '@/dtos/admin-billing';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { billingHttpError } from '@/services/billing/billing-http';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  try {
    // Irreversible entitlement mutation: hold it to the same origin and
    // double-submit token boundary as every other billing mutation.
    assertBillingMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: adminSubscriptionIdRouteParamsSchema,
      body: revokeSubscriptionRequestSchema,
    });
    if (!parsed.ok) return parsed.response;

    const result = await createEntitlementAdminService().revoke(
      parsed.params.id,
      parsed.body.reason,
    );
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-revoke-entitlement');
  }
});
