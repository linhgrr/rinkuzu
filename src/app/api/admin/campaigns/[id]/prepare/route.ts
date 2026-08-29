import { prepareCampaignSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { prepareCampaign } from '@/lib/communication/campaigns';

export const POST = withCommunicationMutation(
  prepareCampaignSchema,
  'admin-campaign-prepare',
  (id, body, actor) => prepareCampaign(id, actor, body.revision),
);
