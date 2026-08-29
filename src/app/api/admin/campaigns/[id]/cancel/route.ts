import type { NextRequest } from 'next/server';
import { cancelCampaignSchema, communicationIdParamsSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { parseParamsAndBody } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { cancelCampaign } from '@/lib/communication/campaigns';

export const POST = withAdmin<{ id: string }>(async (request: NextRequest, context) => {
  try {
    assertCommunicationMutationRequest(request);
    const parsed = await parseParamsAndBody(request, context.params, {
      params: communicationIdParamsSchema,
      body: cancelCampaignSchema,
    });
    if (!parsed.ok) return parsed.response;
    return apiOk(
      await cancelCampaign(
        parsed.params.id,
        { id: context.userId, email: context.email },
        parsed.body.revision,
        parsed.body.reason,
      ),
    );
  } catch (error) {
    return communicationHttpError(error, 'admin-campaign-cancel');
  }
});
