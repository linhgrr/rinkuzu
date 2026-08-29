import { cancelCampaignSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { cancelCampaign } from '@/lib/communication/campaigns';

export const POST = withCommunicationMutation(
  cancelCampaignSchema,
  'admin-campaign-cancel',
  (id, body, actor) => cancelCampaign(id, actor, body.revision, body.reason),
);
