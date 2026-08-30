import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import {
  createPlanRequestSchema,
  deletePlanRequestSchema,
  updatePlanRequestSchema,
} from '@/dtos/admin-billing';
import { getAdminSubscriptionService } from '@/lib/admin-subscription-factory';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { billingHttpError } from '@/services/billing/billing-http';
import { parseJsonBody } from '@/lib/api/validated';

const adminSubscriptionService = getAdminSubscriptionService();

export const GET = withAdmin(async () => {
  const result = await adminSubscriptionService.listPlans();
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

// PATCH to update a plan { id, ...fields }
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    // Plan price drives every future quote, so hold plan writes to the same
    // origin and double-submit boundary as the rest of billing.
    assertBillingMutationRequest(request);
    const input = await parseJsonBody(request, updatePlanRequestSchema);
    if (!input.ok) return input.response;

    const result = await adminSubscriptionService.updatePlan(input.data);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-update-plan');
  }
});

// POST to create a new plan
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const input = await parseJsonBody(request, createPlanRequestSchema);
    if (!input.ok) return input.response;

    const result = await adminSubscriptionService.createPlan(input.data);
    return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-create-plan');
  }
});

// DELETE to remove a plan
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const input = await parseJsonBody(request, deletePlanRequestSchema);
    if (!input.ok) return input.response;

    const result = await adminSubscriptionService.deletePlan(input.data.id);
    return result.success
      ? apiOk(result.data, 200, { meta: { message: 'Plan deleted successfully' } })
      : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-delete-plan');
  }
});
