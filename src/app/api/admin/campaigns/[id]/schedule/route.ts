import { scheduleCampaignSchema } from '@/dtos/communication';
import { withCommunicationMutation } from '@/lib/api/communication-mutation';
import { scheduleCampaign } from '@/lib/communication/campaigns';

export const POST = withCommunicationMutation(
  scheduleCampaignSchema,
  'admin-campaign-schedule',
  (id, body, actor) => scheduleCampaign(id, actor, body),
);
