import 'server-only';

import { randomBytes } from 'node:crypto';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Types } from 'mongoose';
import type { WebhookEventPayload } from 'resend';

import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { logger } from '@/lib/logger';
import { BUCKET_NAME, s3Client } from '@/lib/s3';
import {
  EmailCampaign,
  EmailCampaignAudience,
  EmailDeliveryEvent,
  EmailOutbox,
  FeedbackConversation,
  FeedbackMessage,
  MarketingConsentEvent,
  MarketingContactState,
  MarketingPreference,
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  WebhookEvent,
  type FeedbackStatus,
  type MarketingTopic,
  type OutboxEntityType,
  type OutboxKind,
} from '@/models/Communication';
import User from '@/models/User';
import { ACCOUNT_DISABLE_ACTIVE } from '@/shared/constants/account-disable';
import { canonicalizeEmail } from '@/shared/email/canonical-email';
import {
  addCampaignContact,
  cancelBroadcast,
  communicationEnvironment,
  getContactTopics,
  getReceivingEmail,
  marketingTopicId,
  sendCommunicationEmail,
  type OutboundCommunicationEmail,
} from './resend';
import {
  extractFeedbackReplyToken,
  normalizeInboundFeedbackBody,
  parseInboundSenderAddress,
} from './inbound';
import {
  cancelQueuedFeedbackMail,
  CLOSED_FEEDBACK_STATUSES,
  CommunicationError,
  compactFeedbackReplyToken,
  DAY,
  digest,
  feedbackReplyAddress,
  isClosedFeedbackStatus,
  OPEN_FEEDBACK_STATUSES,
} from './internal';
import { prepareReviewReminder, reviewReminderSendingEnabled } from './review-reminder';

function configuredRate(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${name} must be a number greater than 0 and at most 1`);
  }
  return parsed;
}

/**
 * Provider errors are surfaced to admins and to logs, so anything that could
 * carry a reply token or a recipient address is redacted before it is stored.
 */
function sanitizeOutboxError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Email send failed';
  return raw
    .replaceAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gu, '[email]')
    .replaceAll(/\b[A-Za-z0-9_-]{24,}\b/gu, '[redacted]')
    .slice(0, 2_000);
}

async function quarantineWebhook(
  externalId: string,
  reason: string,
): Promise<{ status: 'quarantined'; reason: string }> {
  await WebhookEvent.updateOne(
    { externalId },
    {
      $set: {
        status: 'quarantined',
        quarantineReason: reason,
        processedAt: new Date(),
        leaseUntil: null,
      },
    },
  );
  return { status: 'quarantined', reason };
}

async function processInboundFeedback(
  externalId: string,
  event: Extract<WebhookEventPayload, { type: 'email.received' }>,
) {
  const replyDomain = communicationEnvironment('FEEDBACK_REPLY_DOMAIN').toLowerCase();
  const destination = event.data.to.find((address) =>
    address.toLowerCase().endsWith(`@${replyDomain}`),
  );
  const token = extractFeedbackReplyToken(event.data.to, replyDomain);
  if (!destination || !token) {
    return quarantineWebhook(externalId, 'unknown_reply_destination');
  }
  const conversation = await FeedbackConversation.findOne({
    replyAddressTokenHash: digest(token),
  });
  if (!conversation) return quarantineWebhook(externalId, 'unknown_reply_token');
  if (isClosedFeedbackStatus(conversation.status)) {
    return quarantineWebhook(externalId, 'conversation_closed');
  }
  const user = await User.findOne({
    _id: conversation.userId,
    disable: ACCOUNT_DISABLE_ACTIVE,
    emailVerified: { $type: 'date' },
  }).select('email');
  if (!user || parseInboundSenderAddress(event.data.from) !== canonicalizeEmail(user.email)) {
    return quarantineWebhook(externalId, 'sender_mismatch');
  }
  const inbound = await getReceivingEmail(event.data.email_id);
  if (
    !inbound.to.some((address) => canonicalizeEmail(address) === canonicalizeEmail(destination))
  ) {
    return quarantineWebhook(externalId, 'receiving_destination_mismatch');
  }
  if (parseInboundSenderAddress(inbound.from) !== canonicalizeEmail(user.email)) {
    return quarantineWebhook(externalId, 'receiving_sender_mismatch');
  }
  let body: string;
  try {
    body = normalizeInboundFeedbackBody(inbound.text, inbound.html);
  } catch (error) {
    throw new CommunicationError(
      'empty_inbound_email',
      error instanceof Error ? error.message : 'Inbound email is empty',
      400,
    );
  }
  const created = await FeedbackMessage.findOneAndUpdate(
    { emailId: event.data.email_id },
    {
      $setOnInsert: {
        conversationId: conversation._id,
        direction: 'inbound',
        source: 'email_inbound',
        body,
        emailId: event.data.email_id,
        messageIdHeader: inbound.message_id,
        inReplyTo: inbound.headers?.['in-reply-to'] ?? null,
        hasAttachments: inbound.attachments.length > 0,
        clientMessageId: `inbound:${event.data.email_id}`,
      },
    },
    { upsert: true, new: true },
  );
  const references = new Set(conversation.references);
  if (inbound.message_id) references.add(inbound.message_id);
  conversation.status = conversation.repliedAt ? 'in_conversation' : 'replied';
  conversation.repliedAt ??= created.createdAt;
  conversation.lastMessageAt = created.createdAt;
  conversation.lastMessageIdHeader = inbound.message_id;
  conversation.references = [...references].slice(-20);
  conversation.revision += 1;
  await conversation.save();
  await WebhookEvent.updateOne(
    { externalId },
    {
      $set: {
        status: 'processed',
        processedAt: new Date(),
        emailId: event.data.email_id,
        leaseUntil: null,
      },
    },
  );
  const conversationId: string = conversation.id;
  return { status: 'processed' as const, conversationId };
}

const CAMPAIGN_METRIC_FIELD: Partial<Record<WebhookEventPayload['type'], string>> = {
  'email.sent': 'metrics.sent',
  'email.delivered': 'metrics.delivered',
  'email.bounced': 'metrics.bounced',
  'email.complained': 'metrics.complained',
  'email.opened': 'metrics.opened',
  'email.clicked': 'metrics.clicked',
  'email.suppressed': 'metrics.bounced',
};

async function enforceCampaignSafety(campaignId: Types.ObjectId): Promise<void> {
  const campaign = await EmailCampaign.findById(campaignId);
  if (!campaign || !['scheduled', 'sending'].includes(campaign.status)) return;
  const complaintLimit = Math.max(
    1,
    Math.ceil(campaign.recipientCount * configuredRate('MARKETING_COMPLAINT_STOP_RATE', 0.001)),
  );
  const bounceLimit = Math.max(
    1,
    Math.ceil(campaign.recipientCount * configuredRate('MARKETING_HARD_BOUNCE_STOP_RATE', 0.05)),
  );
  const reason =
    campaign.metrics.complained >= complaintLimit
      ? 'Automatic stop: complaint threshold reached'
      : campaign.metrics.bounced >= bounceLimit
        ? 'Automatic stop: hard-bounce threshold reached'
        : null;
  if (!reason) return;
  if (campaign.resendBroadcastId) {
    try {
      await cancelBroadcast(campaign.resendBroadcastId);
    } catch (error) {
      logger.warn(
        { error, campaignId: campaign.id },
        'Broadcast could not be cancelled after threshold',
      );
    }
  }
  campaign.status = 'failed';
  campaign.stoppedAt = new Date();
  campaign.stopReason = reason;
  campaign.revision += 1;
  await campaign.save();
}

type SuppressionStatus = 'suppressed' | 'hard_bounced' | 'complained';

async function recordMarketingSuppression(
  recipients: string[],
  incomingStatus: SuppressionStatus,
): Promise<void> {
  const incomingRank =
    incomingStatus === 'complained' ? 3 : incomingStatus === 'hard_bounced' ? 2 : 1;
  for (const recipient of recipients) {
    const user = await User.findOne({ email: canonicalizeEmail(recipient) }).select('_id email');
    if (!user) continue;
    await MarketingContactState.updateOne(
      { userId: user._id },
      [
        {
          $set: {
            email: user.email,
            lastEventAt: new Date(),
            status: {
              $let: {
                vars: {
                  currentStatus: { $ifNull: ['$status', 'deliverable'] },
                  currentRank: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$status', 'complained'] }, then: 3 },
                        { case: { $eq: ['$status', 'hard_bounced'] }, then: 2 },
                        { case: { $eq: ['$status', 'suppressed'] }, then: 1 },
                      ],
                      default: 0,
                    },
                  },
                },
                in: {
                  $cond: [
                    { $gt: [incomingRank, '$$currentRank'] },
                    incomingStatus,
                    '$$currentStatus',
                  ],
                },
              },
            },
          },
        },
      ],
      { upsert: true },
    );
  }
}

async function campaignTerminalDeliverySummary(campaignId: Types.ObjectId): Promise<{
  terminalRecipients: number;
  failedRecipients: number;
}> {
  const [summary] = await EmailDeliveryEvent.aggregate<{
    terminalRecipients: number;
    failedRecipients: number;
  }>([
    {
      $match: {
        campaignId,
        emailId: { $type: 'string' },
        eventType: {
          $in: ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'],
        },
      },
    },
    {
      $group: {
        _id: '$emailId',
        failed: {
          $max: {
            $cond: [
              { $in: ['$eventType', ['email.bounced', 'email.complained', 'email.suppressed']] },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        terminalRecipients: { $sum: 1 },
        failedRecipients: { $sum: '$failed' },
      },
    },
  ]);
  return summary ?? { terminalRecipients: 0, failedRecipients: 0 };
}

/** The provider email id an event refers to, when it carries one. */
function webhookEmailId(event: WebhookEventPayload): string | null {
  return 'email_id' in event.data ? event.data.email_id : null;
}

async function processDeliveryEvent(
  externalId: string,
  event: Exclude<WebhookEventPayload, { type: 'email.received' }>,
): Promise<void> {
  if (!('email_id' in event.data)) return;
  const emailData = event.data;
  const suppressionStatus: SuppressionStatus | null =
    event.type === 'email.complained'
      ? 'complained'
      : event.type === 'email.bounced'
        ? 'hard_bounced'
        : event.type === 'email.suppressed'
          ? 'suppressed'
          : null;
  if (suppressionStatus) {
    await recordMarketingSuppression(emailData.to, suppressionStatus);
  }
  const broadcastId = 'broadcast_id' in emailData ? emailData.broadcast_id : undefined;
  const tags = 'tags' in emailData ? emailData.tags : undefined;
  const campaign = broadcastId
    ? await EmailCampaign.findOne({ resendBroadcastId: broadcastId })
    : tags?.['entity_type'] === 'email_campaign'
      ? await EmailCampaign.findById(tags['entity_id'])
      : null;
  if (campaign) {
    let duplicateDeliveryEvent = false;
    try {
      await EmailDeliveryEvent.create({
        externalEventId: externalId,
        campaignId: campaign._id,
        eventType: event.type,
        emailId: emailData.email_id,
        expiresAt: new Date(Date.now() + 30 * DAY),
      });
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) throw error;
      duplicateDeliveryEvent = true;
    }
    const metricField = CAMPAIGN_METRIC_FIELD[event.type];
    if (metricField && !duplicateDeliveryEvent) {
      await EmailCampaign.updateOne({ _id: campaign._id }, { $inc: { [metricField]: 1 } });
    }
    if (event.type === 'email.sent' && !duplicateDeliveryEvent) {
      await EmailCampaign.updateOne(
        { _id: campaign._id, status: { $in: ['scheduled', 'sending'] } },
        {
          $set: {
            status: 'sending',
            sendingStartedAt: campaign.sendingStartedAt ?? new Date(),
          },
        },
      );
    }
    if (!duplicateDeliveryEvent) await enforceCampaignSafety(campaign._id);
    const refreshed = await EmailCampaign.findById(campaign._id);
    if (refreshed?.status === 'sending') {
      const terminal = await campaignTerminalDeliverySummary(campaign._id);
      if (terminal.terminalRecipients >= refreshed.recipientCount) {
        await EmailCampaign.updateOne(
          { _id: campaign._id, status: 'sending' },
          {
            $set: {
              status: terminal.failedRecipients > 0 ? 'partially_failed' : 'sent',
              sentAt: new Date(),
            },
            $inc: { revision: 1 },
          },
        );
      }
    }
  }
  if (
    event.type === 'email.bounced' ||
    event.type === 'email.complained' ||
    event.type === 'email.failed'
  ) {
    const outbox = await EmailOutbox.findOne({ externalEmailId: emailData.email_id });
    if (outbox?.entityType === 'feedback_conversation') {
      await FeedbackConversation.updateOne(
        { _id: outbox.entityId, status: { $in: ['queued', 'sent', 'in_conversation'] } },
        { $set: { status: 'failed' }, $inc: { revision: 1 } },
      );
    }
  }
}

async function syncUnsubscribeEvent(
  event: Extract<WebhookEventPayload, { type: 'contact.updated' }>,
): Promise<void> {
  const user = await User.findOne({ email: canonicalizeEmail(event.data.email) }).select(
    '_id email',
  );
  if (!user) return;
  const topics = await getContactTopics(user.email);
  const productTopicId = marketingTopicId('product_updates');
  const promotionTopicId = marketingTopicId('promotions');
  const productUpdates =
    topics.find((topic) => topic.id === productTopicId)?.subscription === 'opt_in';
  const promotions =
    topics.find((topic) => topic.id === promotionTopicId)?.subscription === 'opt_in';
  const current = await MarketingPreference.findOne({ userId: user._id });
  const changes: Array<{ topic: MarketingTopic; action: 'opt_in' | 'opt_out' }> = [];
  if ((current?.productUpdates ?? false) !== productUpdates) {
    changes.push({ topic: 'product_updates', action: productUpdates ? 'opt_in' : 'opt_out' });
  }
  if ((current?.promotions ?? false) !== promotions) {
    changes.push({ topic: 'promotions', action: promotions ? 'opt_in' : 'opt_out' });
  }
  await MarketingPreference.updateOne(
    { userId: user._id },
    { $set: { productUpdates, promotions } },
    { upsert: true },
  );
  if (changes.length) {
    await MarketingConsentEvent.insertMany(
      changes.map((change) => ({ userId: user._id, ...change, source: 'unsubscribe' })),
    );
  }
}

export async function processResendWebhook(
  externalId: string,
  payloadDigest: string,
  event: WebhookEventPayload,
): Promise<
  | { status: 'quarantined'; reason: string }
  // Mongoose's Document#id type is `any`, but the runtime value is _id.toString(), a string.
  | { status: 'processed'; conversationId: string }
  | { status: 'failed' | 'processing' | 'processed' | 'quarantined'; duplicate: boolean }
  | { status: 'processed'; duplicate?: undefined }
> {
  await connectDB();
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000);
  let existing = await WebhookEvent.findOne({ externalId });
  let claimedByThisRequest = false;
  if (existing && existing.payloadDigest !== payloadDigest) {
    throw new CommunicationError('conflict', 'Webhook id was reused with a different payload', 409);
  }
  if (existing && ['processed', 'quarantined'].includes(existing.status)) {
    return { status: existing.status, duplicate: true };
  }

  if (!existing) {
    try {
      existing = await WebhookEvent.create({
        externalId,
        eventType: event.type,
        payloadDigest,
        status: 'processing',
        attempts: 1,
        leaseUntil,
        expiresAt: new Date(now.getTime() + 30 * DAY),
      });
      claimedByThisRequest = true;
    } catch (error) {
      if (!(error instanceof Error && error.name === 'MongoServerError')) throw error;
      existing = await WebhookEvent.findOne({ externalId });
    }
  }
  if (existing && !claimedByThisRequest) {
    if (existing.payloadDigest !== payloadDigest) {
      throw new CommunicationError(
        'conflict',
        'Webhook id was reused with a different payload',
        409,
      );
    }
    if (['processed', 'quarantined'].includes(existing.status)) {
      return { status: existing.status, duplicate: true };
    }
    existing = await WebhookEvent.findOneAndUpdate(
      {
        externalId,
        payloadDigest,
        $or: [
          { status: 'failed' },
          { status: 'processing', leaseUntil: { $lte: now } },
          { status: 'processing', leaseUntil: null },
        ],
      },
      {
        $set: {
          status: 'processing',
          eventType: event.type,
          leaseUntil,
          quarantineReason: null,
          processedAt: null,
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
  }

  if (!existing) {
    throw new CommunicationError(
      'service_unavailable',
      'Webhook event is already being processed',
      503,
    );
  }
  try {
    if (event.type === 'email.received') return processInboundFeedback(externalId, event);
    if (event.type === 'contact.updated') await syncUnsubscribeEvent(event);
    if (event.type.startsWith('email.')) await processDeliveryEvent(externalId, event);
    const emailId = webhookEmailId(event);
    await WebhookEvent.updateOne(
      { externalId },
      {
        // Recording the provider email id is what makes a stored webhook
        // traceable back to the outbox row it describes.
        $set: {
          status: 'processed',
          processedAt: new Date(),
          leaseUntil: null,
          ...(emailId ? { emailId } : {}),
        },
      },
    );
    return { status: 'processed' as const };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 1_000) : 'Webhook processing failed';
    await WebhookEvent.updateOne(
      { externalId },
      {
        $set: {
          status: 'failed',
          quarantineReason: reason,
          processedAt: new Date(),
          leaseUntil: null,
        },
      },
    );
    throw error;
  }
}

type OutboxItem = InstanceType<typeof EmailOutbox>;

/**
 * Resend rejects a reused idempotency key when the payload changed, so a
 * repaired email needs its own key. The key stays deterministic in the repaired
 * address, which keeps retries after a repair idempotent.
 */
function outboxIdempotencyKey(dedupeKey: string, replyTo: string): string {
  return `${dedupeKey}#${digest(replyTo).slice(0, 12)}`;
}

async function cancelOutbox(item: OutboxItem, leaseToken: string, reason: string): Promise<void> {
  logger.warn(
    {
      outboxId: item.id,
      kind: item.kind,
      entityType: item.entityType,
      attempts: item.attempts,
      reason,
    },
    'Communication outbox delivery canceled',
  );
  await EmailOutbox.updateOne(
    { _id: item._id, leaseToken },
    {
      $set: { status: 'canceled', lastError: reason },
      $unset: { leaseToken: '', leaseUntil: '' },
    },
  );
}

/**
 * An invitation whose outbox row has not completed cannot have been accepted by
 * the provider, so a `sent` status on it is left over from when the state was
 * written at queue time. Reset it to the truth before the retry so `sentAt` can
 * be rebased on the real acceptance.
 */
async function demoteUnsentInvitation(
  item: OutboxItem,
  conversation: {
    _id: unknown;
    status: FeedbackStatus;
    queuedAt?: Date | null;
    sentAt?: Date | null;
  },
): Promise<void> {
  if (item.kind !== 'feedback_invitation' || conversation.status !== 'sent') return;
  if (item.externalEmailId) return;
  await FeedbackConversation.updateOne(
    { _id: conversation._id, status: 'sent' },
    {
      $set: {
        status: 'queued',
        queuedAt: conversation.queuedAt ?? conversation.sentAt ?? new Date(),
        sentAt: null,
      },
      $inc: { revision: 1 },
    },
  );
  conversation.status = 'queued';
  logger.warn(
    { outboxId: item.id, kind: item.kind, entityType: item.entityType },
    'Feedback conversation reset to queued because its invitation was never accepted',
  );
}

/**
 * Guard and self-heal a feedback email immediately before it is handed to Resend.
 *
 * Emails queued before the compact Reply-To format existed carry a local part
 * longer than 64 octets, which Resend rejects outright. Rather than queue a
 * second email, the stored row is repaired in place: the dedupe key never
 * changes, so no duplicate row is ever created, and the conversation's inbound
 * routing hash is re-pointed at the address that is actually going out.
 */
async function prepareFeedbackDelivery(
  item: OutboxItem,
  leaseToken: string,
): Promise<'send' | 'canceled' | 'lease_lost'> {
  const conversation = await FeedbackConversation.findById(item.entityId).select(
    'status replyAddressTokenHash queuedAt sentAt',
  );
  if (!conversation) {
    await cancelOutbox(item, leaseToken, 'conversation_missing');
    return 'canceled';
  }
  if (isClosedFeedbackStatus(conversation.status)) {
    await cancelOutbox(item, leaseToken, `conversation_${conversation.status}`);
    return 'canceled';
  }
  await demoteUnsentInvitation(item, conversation);
  const replyToken = compactFeedbackReplyToken(item.entityId.toString());
  const replyTo = feedbackReplyAddress(replyToken);
  const replyAddressTokenHash = digest(replyToken);
  if (item.replyTo !== replyTo) {
    const idempotencyKey = outboxIdempotencyKey(item.dedupeKey, replyTo);
    const repaired = await EmailOutbox.updateOne(
      { _id: item._id, leaseToken },
      { $set: { replyTo, idempotencyKey } },
    );
    // The lease was stolen by another worker; that worker owns the send now.
    if (repaired.matchedCount !== 1) return 'lease_lost';
    item.replyTo = replyTo;
    item.idempotencyKey = idempotencyKey;
    logger.info(
      { outboxId: item.id, kind: item.kind, entityType: item.entityType },
      'Communication outbox Reply-To repaired',
    );
  }
  if (conversation.replyAddressTokenHash !== replyAddressTokenHash) {
    await FeedbackConversation.updateOne(
      { _id: conversation._id },
      { $set: { replyAddressTokenHash } },
    );
  }
  return 'send';
}

/**
 * Promote a conversation only once Resend has accepted the invitation and
 * returned an email id, so `sent`/`sentAt` can never describe an email that
 * does not exist. The 30 day window is rebased on the real acceptance time.
 */
async function markInvitationSent(
  item: OutboxItem,
  externalEmailId: string,
  sentAt: Date,
): Promise<void> {
  if (item.kind !== 'feedback_invitation') return;
  await FeedbackConversation.updateOne(
    { _id: item.entityId, status: 'queued' },
    {
      $set: { status: 'sent', sentAt, expiresAt: new Date(sentAt.getTime() + 30 * DAY) },
      $inc: { revision: 1 },
    },
  );
  logger.info(
    { outboxId: item.id, kind: item.kind, entityType: item.entityType, externalEmailId },
    'Feedback invitation accepted by the email provider',
  );
}

/**
 * The claim-update fragment issued by every lease-based queue in this worker: mark the
 * chosen row `processing`, stamp a fresh two-minute lease window, hand back a token only
 * this claim knows (so a stolen lease can never be released by the loser), and bump the
 * attempt counter. `processOutbox` and `processCampaignAudience` claim from different
 * collections with different filters and sort orders — that part stays in each function —
 * but once a candidate row is chosen, this is the write that claims it in both.
 */
function leaseClaimUpdate(
  now: Date,
  leaseToken: string,
): {
  $set: { status: 'processing'; leaseToken: string; leaseUntil: Date };
  $inc: { attempts: 1 };
} {
  return {
    $set: {
      status: 'processing',
      leaseToken,
      leaseUntil: new Date(now.getTime() + 2 * 60 * 1000),
    },
    $inc: { attempts: 1 },
  };
}

async function processOutbox(
  limit: number,
): Promise<{ completed: number; retried: number; dead: number; canceled: number }> {
  let completed = 0;
  let retried = 0;
  let dead = 0;
  let canceled = 0;
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const leaseToken = randomBytes(24).toString('base64url');
    const item = await EmailOutbox.findOneAndUpdate(
      {
        availableAt: { $lte: now },
        $or: [{ status: 'pending' }, { status: 'processing', leaseUntil: { $lte: now } }],
        // `REVIEW_REMINDER_SENDING_ENABLED=false` holds review emails back (RIN-915).
        ...(reviewReminderSendingEnabled() ? {} : { kind: { $ne: 'review_reminder' } }),
      },
      leaseClaimUpdate(now, leaseToken),
      { sort: { availableAt: 1 }, new: true },
    );
    if (!item) break;
    try {
      if (item.entityType === 'feedback_conversation') {
        const outcome = await prepareFeedbackDelivery(item, leaseToken);
        if (outcome === 'canceled') {
          canceled += 1;
          continue;
        }
        if (outcome === 'lease_lost') continue;
      }
      let content: Pick<
        OutboundCommunicationEmail,
        'subject' | 'html' | 'text' | 'tags' | 'headers'
      > = { subject: item.subject, html: item.html, text: item.text };
      if (item.kind === 'review_reminder') {
        const prepared = await prepareReviewReminder(item, now);
        if (prepared.decision === 'cancel') {
          await cancelOutbox(item, leaseToken, prepared.reason);
          canceled += 1;
          continue;
        }
        if (prepared.decision === 'wait') {
          await EmailOutbox.updateOne(
            { _id: item._id, leaseToken },
            { $set: { status: 'pending' }, $unset: { leaseToken: '', leaseUntil: '' } },
          );
          continue;
        }
        content = prepared.mail;
      }
      const externalEmailId = await sendCommunicationEmail({
        to: item.to,
        from: item.from,
        replyTo: item.replyTo,
        ...content,
        inReplyTo: item.inReplyTo,
        references: item.references,
        idempotencyKey: item.idempotencyKey ?? item.dedupeKey,
        entityType: item.entityType,
        entityId: item.entityId.toString(),
      });
      const acceptedAt = new Date();
      // Everything derived from the accepted email is written before the outbox
      // row is closed. Only a `pending`/`processing` row is ever re-claimed, so
      // closing it first would make an interruption here permanent; this way an
      // interruption just replays, and the replay is idempotent in every step:
      // Resend returns the same id for the same key, and both writes below are
      // guarded so the second pass is a no-op.
      const messageId = item.dedupeKey.split('/').at(-1);
      if (
        item.entityType === 'feedback_conversation' &&
        messageId &&
        Types.ObjectId.isValid(messageId)
      ) {
        await FeedbackMessage.updateOne(
          { _id: messageId, conversationId: item.entityId, direction: 'outbound' },
          { $set: { emailId: externalEmailId } },
        );
      }
      await markInvitationSent(item, externalEmailId, acceptedAt);
      await EmailOutbox.updateOne(
        { _id: item._id, leaseToken },
        {
          // A review email is rendered at send time; keep what actually went out.
          $set: {
            status: 'completed',
            externalEmailId,
            subject: content.subject,
            html: content.html,
            text: content.text,
          },
          $unset: { leaseToken: '', leaseUntil: '', lastError: '' },
        },
      );
      completed += 1;
    } catch (error) {
      const lastError = sanitizeOutboxError(error);
      const isDead = item.attempts >= 12;
      const delay = Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.min(item.attempts, 10));
      logger.warn(
        {
          outboxId: item.id,
          kind: item.kind,
          entityType: item.entityType,
          attempts: item.attempts,
          isDead,
          lastError,
        },
        'Communication outbox delivery failed',
      );
      await EmailOutbox.updateOne(
        { _id: item._id, leaseToken },
        {
          $set: {
            status: isDead ? 'dead' : 'pending',
            lastError,
            availableAt: new Date(Date.now() + delay),
          },
          $unset: { leaseToken: '', leaseUntil: '' },
        },
      );
      if (isDead && item.entityType === 'feedback_conversation') {
        await FeedbackConversation.updateOne(
          { _id: item.entityId, status: { $in: OPEN_FEEDBACK_STATUSES } },
          { $set: { status: 'failed' }, $inc: { revision: 1 } },
        );
      }
      if (isDead) dead += 1;
      else retried += 1;
    }
  }
  return { completed, retried, dead, canceled };
}

async function processCampaignAudience(limit: number): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  const campaigns = await EmailCampaign.find({ status: 'preparing_audience' }).sort({
    createdAt: 1,
  });
  let remainingBudget = limit;
  for (const campaign of campaigns) {
    if (remainingBudget <= 0) break;
    if (!campaign.resendSegmentId) {
      campaign.status = 'failed';
      campaign.stopReason = 'Audience segment is missing';
      await campaign.save();
      continue;
    }
    while (remainingBudget > 0) {
      const now = new Date();
      const leaseToken = randomBytes(24).toString('base64url');
      const item = await EmailCampaignAudience.findOneAndUpdate(
        {
          campaignId: campaign._id,
          attempts: { $lt: 12 },
          $or: [
            { status: 'prepared', availableAt: { $lte: now } },
            { status: 'processing', leaseUntil: { $lte: now } },
          ],
        },
        leaseClaimUpdate(now, leaseToken),
        { sort: { availableAt: 1, createdAt: 1 }, new: true },
      );
      if (!item) break;
      try {
        const [preference, contactState, user] = await Promise.all([
          MarketingPreference.findOne({ userId: item.userId }),
          MarketingContactState.findOne({ userId: item.userId }),
          User.findOne({
            _id: item.userId,
            disable: ACCOUNT_DISABLE_ACTIVE,
            emailVerified: { $type: 'date' },
          }).select('email'),
        ]);
        const topicEnabled =
          campaign.topic === 'product_updates'
            ? preference?.productUpdates === true
            : preference?.promotions === true;
        const deliverable = !contactState || contactState.status === 'deliverable';
        const sameVerifiedAddress =
          user && canonicalizeEmail(user.email) === canonicalizeEmail(item.email);
        if (!topicEnabled || !deliverable || !sameVerifiedAddress) {
          await EmailCampaignAudience.updateOne(
            { _id: item._id, status: 'processing', leaseToken },
            {
              $set: {
                status: 'suppressed',
                leaseToken: null,
                leaseUntil: null,
                lastError: 'Recipient is no longer eligible',
              },
            },
          );
          remainingBudget -= 1;
          continue;
        }
        const contactId = await addCampaignContact({
          email: item.email,
          segmentId: campaign.resendSegmentId,
          topicId: marketingTopicId(campaign.topic),
        });
        await EmailCampaignAudience.updateOne(
          { _id: item._id, status: 'processing', leaseToken },
          {
            $set: {
              status: 'synced',
              leaseToken: null,
              leaseUntil: null,
              lastError: null,
            },
          },
        );
        await MarketingContactState.updateOne(
          { userId: item.userId },
          {
            $set: { email: item.email, resendContactId: contactId, lastEventAt: new Date() },
            $setOnInsert: { status: 'deliverable' },
          },
          { upsert: true },
        );
        synced += 1;
      } catch (error) {
        const isDead = item.attempts >= 12;
        const backoff = Math.min(60 * 60 * 1000, 2 ** Math.min(item.attempts, 10) * 1000);
        await EmailCampaignAudience.updateOne(
          { _id: item._id, status: 'processing', leaseToken },
          {
            $set: {
              status: isDead ? 'failed' : 'prepared',
              availableAt: new Date(Date.now() + backoff),
              leaseToken: null,
              leaseUntil: null,
              lastError:
                error instanceof Error ? error.message.slice(0, 1_000) : 'Contact sync failed',
            },
          },
        );
        if (isDead) failed += 1;
      }
      remainingBudget -= 1;
    }
    const [pending, syncedCount, failedCount, suppressedCount] = await Promise.all([
      EmailCampaignAudience.countDocuments({
        campaignId: campaign._id,
        status: { $in: ['prepared', 'processing'] },
      }),
      EmailCampaignAudience.countDocuments({ campaignId: campaign._id, status: 'synced' }),
      EmailCampaignAudience.countDocuments({ campaignId: campaign._id, status: 'failed' }),
      EmailCampaignAudience.countDocuments({ campaignId: campaign._id, status: 'suppressed' }),
    ]);
    if (pending === 0) {
      await EmailCampaign.updateOne(
        { _id: campaign._id, status: 'preparing_audience' },
        {
          $set: {
            status: syncedCount > 0 || campaign.recipientCount === 0 ? 'ready' : 'failed',
            recipientCount: syncedCount,
            stopReason:
              failedCount > 0 || suppressedCount > 0
                ? `${failedCount} contacts failed; ${suppressedCount} became ineligible`
                : null,
          },
          $inc: { revision: 1 },
        },
      );
    }
  }
  return { synced, failed };
}

async function processPendingCampaignCancellations(limit: number): Promise<number> {
  const campaigns = await EmailCampaign.find({
    status: 'cancelled',
    resendBroadcastId: { $type: 'string' },
  })
    .sort({ stoppedAt: 1 })
    .limit(limit);
  let completed = 0;
  for (const campaign of campaigns) {
    if (!campaign.resendBroadcastId) continue;
    try {
      await cancelBroadcast(campaign.resendBroadcastId);
      const result = await EmailCampaign.updateOne(
        {
          _id: campaign._id,
          status: 'cancelled',
          resendBroadcastId: campaign.resendBroadcastId,
        },
        { $set: { resendBroadcastId: null } },
      );
      completed += result.modifiedCount;
    } catch (error) {
      logger.warn(
        { error, campaignId: campaign.id, broadcastId: campaign.resendBroadcastId },
        'Pending campaign cancellation retry failed',
      );
    }
  }
  return completed;
}

async function processCommunicationRetention(limit: number): Promise<{
  orphanedAttachments: number;
  supportTickets: number;
  feedbackConversations: number;
}> {
  const expiredAttachments = await SupportAttachment.find({
    ticketId: null,
    messageId: null,
    expiresAt: { $lte: new Date() },
  })
    .select('_id storageKey')
    .limit(limit);
  let orphanedAttachments = 0;
  for (const attachment of expiredAttachments) {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.storageKey }),
    );
    const deleted = await SupportAttachment.deleteOne({
      _id: attachment._id,
      ticketId: null,
      messageId: null,
    });
    orphanedAttachments += deleted.deletedCount;
  }
  const cutoff = new Date(Date.now() - 730 * DAY);
  const supportTickets = await SupportTicket.find({
    status: 'closed',
    closedAt: { $lte: cutoff },
  })
    .select('_id')
    .limit(limit);
  const supportIds = supportTickets.map((ticket) => ticket._id);
  if (supportIds.length) {
    const attachments = await SupportAttachment.find({ ticketId: { $in: supportIds } }).select(
      'storageKey',
    );
    for (const attachment of attachments) {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.storageKey }),
      );
    }
    await Promise.all([
      SupportAttachment.deleteMany({ ticketId: { $in: supportIds } }),
      SupportMessage.deleteMany({ ticketId: { $in: supportIds } }),
      EmailOutbox.deleteMany({ entityType: 'support_ticket', entityId: { $in: supportIds } }),
    ]);
    await SupportTicket.deleteMany({ _id: { $in: supportIds } });
  }

  const feedbackConversations = await FeedbackConversation.find({
    status: { $in: CLOSED_FEEDBACK_STATUSES },
    updatedAt: { $lte: cutoff },
  })
    .select('_id')
    .limit(limit);
  const feedbackIds = feedbackConversations.map((conversation) => conversation._id);
  if (feedbackIds.length) {
    await Promise.all([
      FeedbackMessage.deleteMany({ conversationId: { $in: feedbackIds } }),
      EmailOutbox.deleteMany({
        entityType: 'feedback_conversation',
        entityId: { $in: feedbackIds },
      }),
    ]);
    await FeedbackConversation.deleteMany({ _id: { $in: feedbackIds } });
  }

  return {
    orphanedAttachments,
    supportTickets: supportIds.length,
    feedbackConversations: feedbackIds.length,
  };
}

/**
 * Close invitations nobody answered inside the 30 day window. `expiresAt` is
 * rebased on real acceptance, so this can only fire against emails Resend
 * actually took. Bounded per tick: a backlog would otherwise build one `$in`
 * large enough to slow the whole worker, and the remainder is simply picked up
 * by the next run.
 */
async function expireUnansweredFeedback(limit: number): Promise<number> {
  const due = await FeedbackConversation.find({
    status: 'sent',
    expiresAt: { $lte: new Date() },
  })
    .select('_id')
    .limit(limit);
  if (!due.length) return 0;
  const ids = due.map((entry) => entry._id);
  const expired = await FeedbackConversation.updateMany(
    { _id: { $in: ids }, status: 'sent' },
    { $set: { status: 'expired' }, $inc: { revision: 1 } },
  );
  await cancelQueuedFeedbackMail(ids);
  return expired.modifiedCount;
}

export async function runCommunicationWorker(limit = 50): Promise<{
  outbox: { completed: number; retried: number; dead: number; canceled: number };
  campaignAudience: { synced: number; failed: number };
  campaignCancellations: number;
  expiredFeedback: number;
  retention: {
    orphanedAttachments: number;
    supportTickets: number;
    feedbackConversations: number;
  };
}> {
  await connectDB();
  const [outbox, campaignAudience, campaignCancellations, expired, retention] = await Promise.all([
    processOutbox(Math.min(limit, 50)),
    processCampaignAudience(Math.min(limit, 100)),
    processPendingCampaignCancellations(Math.min(limit, 25)),
    expireUnansweredFeedback(Math.min(limit, 100)),
    processCommunicationRetention(Math.min(limit, 25)),
  ]);
  await EmailCampaign.updateMany(
    { status: 'scheduled', scheduledAt: { $lte: new Date() } },
    { $set: { status: 'sending', sendingStartedAt: new Date() }, $inc: { revision: 1 } },
  );
  return {
    outbox,
    campaignAudience,
    campaignCancellations,
    expiredFeedback: expired,
    retention,
  };
}

export async function communicationHealth(): Promise<{
  pending: number;
  processing: number;
  dead: number;
  canceled: number;
  quarantined: number;
  preparingCampaigns: number;
  stuckDetails: {
    id: string;
    kind: OutboxKind;
    entityType: OutboxEntityType;
    status: 'pending' | 'processing' | 'completed' | 'dead' | 'canceled';
    attempts: number;
    availableAt: string;
    lastError: string | null;
    updatedAt: string;
  }[];
}> {
  await connectDB();
  const [pending, processing, dead, canceled, quarantined, preparingCampaigns, stuckDetails] =
    await Promise.all([
      EmailOutbox.countDocuments({ status: 'pending' }),
      EmailOutbox.countDocuments({ status: 'processing' }),
      EmailOutbox.countDocuments({ status: 'dead' }),
      EmailOutbox.countDocuments({ status: 'canceled' }),
      WebhookEvent.countDocuments({ status: 'quarantined' }),
      EmailCampaign.countDocuments({ status: 'preparing_audience' }),
      EmailOutbox.find({ status: { $in: ['pending', 'processing', 'dead'] } })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('kind entityType status attempts availableAt lastError updatedAt')
        .lean(),
    ]);
  return {
    pending,
    processing,
    dead,
    canceled,
    quarantined,
    preparingCampaigns,
    // Operational detail only: no recipient, subject, body or token ever leaves
    // this endpoint, and stored provider errors are re-sanitized on read so rows
    // written before redaction existed cannot leak either.
    stuckDetails: stuckDetails.map((item) => ({
      id: item._id.toString(),
      kind: item.kind,
      entityType: item.entityType,
      status: item.status,
      attempts: item.attempts,
      availableAt: item.availableAt.toISOString(),
      lastError: item.lastError ? sanitizeOutboxError(new Error(item.lastError)) : null,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}
