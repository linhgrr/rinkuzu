import type { NextRequest } from 'next/server';
import { campaignListQuerySchema, createCampaignSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateSearchParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createCampaign, listCampaigns } from '@/lib/communication/campaigns';

export const GET = withAdmin(async (request) => {
  const query = readAndValidateSearchParams(request, campaignListQuerySchema);
  if (!query.success) return apiErr('validation_error', query.error, 400, { fields: query.fields });
  try {
    return apiOk(await listCampaigns(query.data));
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-list');
  }
});

export const POST = withAdmin(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await readAndValidateJson(request, createCampaignSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(await createCampaign({ id: userId, email }, input.data), 201);
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-create');
  }
});
