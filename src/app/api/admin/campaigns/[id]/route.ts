import { communicationIdParamsSchema, updateCampaignSchema } from '@/dtos/communication';
import { withAdmin } from '@/lib/api/auth';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { parseRouteParams } from '@/lib/api/validated';
import { apiOk } from '@/lib/api/response';
import { communicationHttpError } from '@/lib/communication/http';
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

export const PATCH = withCommunicationMutation(
  updateCampaignSchema,
  'admin-campaign-update',
  (id, body, actor) => updateCampaign(id, actor, body),
);
