import { NextRequest } from 'next/server';
import { createEntitlementAdminService } from '@/lib/entitlement-admin-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
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
    const parsedParams = readAndValidateRouteParams(
      context.params,
      adminSubscriptionIdRouteParamsSchema,
    );
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
    }

    const input = await readAndValidateJson(request, revokeSubscriptionRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await createEntitlementAdminService().revoke(
      parsedParams.data.id,
      input.data.reason,
    );
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-revoke-entitlement');
  }
});
