import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, updateCampaignSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody, parseRouteParams } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { getCampaign, updateCampaign } from '@/lib/communication/campaigns';

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  const parsed = parseRouteParams(params, communicationIdParamsSchema);
  if (!parsed.ok) return parsed.response;
  try {
    return apiOk(await getCampaign(parsed.data.id));
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-detail');
  }
});

export const PATCH = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: updateCampaignSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await updateCampaign(
        parsed.params.id,
        { id: context.userId, email: context.email },
        parsed.body,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-update');
  }
});
