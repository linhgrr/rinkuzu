/** Campaign statuses the admin screens can name; mirrors the campaign model. */
const CAMPAIGN_STATUSES = [
  'draft',
  'preparing_audience',
  'ready',
  'scheduled',
  'sending',
  'sent',
  'partially_failed',
  'failed',
  'cancelled',
] as const;

type CampaignStatusKey = (typeof CAMPAIGN_STATUSES)[number];

type CampaignStatusTranslator = (key: `campaignStatuses.${CampaignStatusKey}`) => string;

function isCampaignStatus(status: string): status is CampaignStatusKey {
  return (CAMPAIGN_STATUSES as readonly string[]).includes(status);
}

/**
 * Localised campaign status for the `communications.admin` namespace. An unknown
 * status (a newer server) is shown as sent rather than as a missing message.
 */
export function campaignStatusLabel(t: CampaignStatusTranslator, status: string): string {
  return isCampaignStatus(status) ? t(`campaignStatuses.${status}`) : status;
}
