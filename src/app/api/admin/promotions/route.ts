import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { promotionCreateSchema } from '@/dtos/billing';
import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import { createBillingPromotionRepository } from '@/lib/billing-factory';
import { billingHttpError } from '@/services/billing/billing-http';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { parseJsonBody } from '@/lib/api/validated';

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
    const parsed = await parseJsonBody(request, promotionCreateSchema);
    if (!parsed.ok) return parsed.response;
    return apiOk(await createBillingPromotionRepository().createPromotion(parsed.data), 201);
  } catch (error) {
    return billingHttpError(error, 'admin-create-promotion');
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const parsed = await parseJsonBody(request, archivePromotionSchema);
    if (!parsed.ok) return parsed.response;
    return apiOk(await createBillingPromotionRepository().archivePromotion(parsed.data.id));
  } catch (error) {
    return billingHttpError(error, 'admin-archive-promotion');
  }
});
