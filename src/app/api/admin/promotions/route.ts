import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { promotionCreateSchema } from '@/dtos/billing';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import { createBillingPromotionRepository } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';

const archivePromotionSchema = z.strictObject({ id: z.string().regex(/^[a-f\d]{24}$/i) });

export const GET = withAdmin(async () => {
  try {
    return apiOk(await createBillingPromotionRepository().listPromotions());
  } catch (error) {
    return billingHttpError(error, 'admin-list-promotions');
  }
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const parsed = await readAndValidateJson(request, promotionCreateSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    return apiOk(await createBillingPromotionRepository().createPromotion(parsed.data), 201);
  } catch (error) {
    return billingHttpError(error, 'admin-create-promotion');
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const parsed = await readAndValidateJson(request, archivePromotionSchema);
    if (!parsed.success) {
      return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
    }
    return apiOk(await createBillingPromotionRepository().archivePromotion(parsed.data.id));
  } catch (error) {
    return billingHttpError(error, 'admin-archive-promotion');
  }
});
