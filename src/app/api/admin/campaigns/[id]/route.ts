import type { NextRequest } from 'next/server';
import { communicationIdParamsSchema, updateCampaignSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr, apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { getCampaign, updateCampaign } from '@/lib/communication/service';

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  const parsed = readAndValidateRouteParams(params, communicationIdParamsSchema);
  if (!parsed.success)
    return apiErr('validation_error', parsed.error, 400, { fields: parsed.fields });
  try {
    return apiOk(await getCampaign(parsed.data.id));
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-detail');
  }
});

export const PATCH = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const params = readAndValidateRouteParams(context.params, communicationIdParamsSchema);
    if (!params.success)
      return apiErr('validation_error', params.error, 400, { fields: params.fields });
    const input = await readAndValidateJson(request, updateCampaignSchema);
    if (!input.success)
      return apiErr('validation_error', input.error, 400, { fields: input.fields });
    return apiOk(
      await updateCampaign(
        params.data.id,
        { id: context.userId, email: context.email },
        input.data,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-update');
  }
});
