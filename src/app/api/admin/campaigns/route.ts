import type { NextRequest } from 'next/server';
import { campaignListQuerySchema, createCampaignSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { createCampaign, listCampaigns } from '@/lib/communication/campaigns';
import { parseJsonBody, parseSearchParams } from '@/lib/api/validated';

export const GET = withAdmin(async (request) => {
  const query = parseSearchParams(request, campaignListQuerySchema);
  if (!query.ok) return query.response;
  try {
    return apiOk(await listCampaigns(query.data));
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-list');
  }
});

export const POST = withAdmin(async (request: NextRequest, { userId, email }) => {
  try {
    assertCommunicationMutationRequest(request);
    const input = await parseJsonBody(request, createCampaignSchema);
    if (!input.ok) return input.response;
    return apiOk(await createCampaign({ id: userId, email }, input.data), 201);
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-create');
  }
});
