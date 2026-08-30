import { updateCampaignSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { withCommunicationRead } from '@/lib/api/communication-read';
import { getCampaign, updateCampaign } from '@/lib/communication/campaigns';

export const GET = withCommunicationRead('admin-campaign-detail', getCampaign);

export const PATCH = withCommunicationMutation(
  updateCampaignSchema,
  'admin-campaign-update',
  (id, body, actor) => updateCampaign(id, actor, body),
);
