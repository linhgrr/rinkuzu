import { NextRequest } from 'next/server';
import { createEntitlementAdminService } from '@/lib/entitlement-admin-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import {
  adminSubscriptionIdRouteParamsSchema,
  updateSubscriptionRequestSchema,
} from '@/dtos/admin-billing';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  const parsedParams = readAndValidateRouteParams(
    context.params,
    adminSubscriptionIdRouteParamsSchema,
  );
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const input = await readAndValidateJson(request, updateSubscriptionRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const result = await createEntitlementAdminService().revoke(
    parsedParams.data.id,
    input.data.status,
  );
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
