import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import {
  createPlanRequestSchema,
  deletePlanRequestSchema,
  updatePlanRequestSchema,
} from '@/dtos/admin-billing';
import { getAdminBillingService } from '@/lib/admin-billing-factory';
import { assertBillingMutationRequest } from '@/services/billing/billing-security';
import { billingHttpError } from '@/services/billing/billing-http';

const adminBillingService = getAdminBillingService();

export const GET = withAdmin(async () => {
  const result = await adminBillingService.listPlans();
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

// PATCH to update a plan { id, ...fields }
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    // Plan price drives every future quote, so hold plan writes to the same
    // origin and double-submit boundary as the rest of billing.
    assertBillingMutationRequest(request);
    const input = await readAndValidateJson(request, updatePlanRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminBillingService.updatePlan(input.data);
    return result.success ? apiOk(result.data) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-update-plan');
  }
});

// POST to create a new plan
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const input = await readAndValidateJson(request, createPlanRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminBillingService.createPlan(input.data);
    return result.success ? apiOk(result.data, 201) : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-create-plan');
  }
});

// DELETE to remove a plan
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    assertBillingMutationRequest(request);
    const input = await readAndValidateJson(request, deletePlanRequestSchema);
    if (!input.success) {
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    }

    const result = await adminBillingService.deletePlan(input.data.id);
    return result.success
      ? apiOk(result.data, 200, { meta: { message: 'Plan deleted successfully' } })
      : apiServiceErr(result);
  } catch (error) {
    return billingHttpError(error, 'admin-delete-plan');
  }
});
