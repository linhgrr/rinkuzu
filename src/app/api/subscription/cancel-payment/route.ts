import { NextRequest } from 'next/server';
import { createSubscriptionService } from '@/lib/subscription-factory';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { verifySubscriptionRequestSchema } from '@/dtos/subscription';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const input = await readAndValidateJson(request, verifySubscriptionRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const orderCode =
    typeof input.data.orderCode === 'string'
      ? Number.parseInt(input.data.orderCode, 10)
      : input.data.orderCode;
  const result = await createSubscriptionService().reconcilePaymentCancellation(orderCode, userId);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
