import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { updateSubscriptionRequestSchema } from '@/dtos/admin-billing';
import { objectIdSchema } from '@/lib/validation/common';

export const dynamic = 'force-dynamic';

export const PATCH = withAdmin(async (request: NextRequest, context) => {
  const rawId = context.params['id'];
  const parsedId = objectIdSchema.safeParse(Array.isArray(rawId) ? rawId[0] : rawId);
  if (!parsedId.success) {
    return apiErr('validation_error', 'Invalid subscription id', 400);
  }

  const input = await readAndValidateJson(request, updateSubscriptionRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const subscriptionService = createSubscriptionService();
  const result = await subscriptionService.updateSubscriptionById(parsedId.data, input.data);
  return result.success ? apiOk(null) : apiServiceErr(result);
});
