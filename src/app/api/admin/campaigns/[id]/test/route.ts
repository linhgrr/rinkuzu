import { testCampaignSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { testCampaign } from '@/lib/communication/campaigns';

export const POST = withCommunicationMutation(
  testCampaignSchema,
  'admin-campaign-test',
  (id, body, actor) => testCampaign(id, actor, body.revision),
);
