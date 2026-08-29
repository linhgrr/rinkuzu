import 'server-only';

import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import type { z } from 'zod';

import { campaignBlockSchema } from '@/dtos/communication';
import type {
  campaignListQuerySchema,
  createCampaignSchema,
  marketingPreferenceSchema,
  scheduleCampaignSchema,
  updateCampaignSchema,
} from '@/dtos/communication';
import connectDB from '@/lib/mongoose';
import { logger } from '@/lib/logger';
import {
  EmailCampaign,
  EmailCampaignAudience,
  MarketingConsentEvent,
  MarketingContactState,
  MarketingPreference,
  type CampaignStatus,
  type MarketingTopic,
} from '@/models/Communication';
import User from '@/models/User';
import { EntitlementAccount } from '@/models/Billing';
import { ACCOUNT_DISABLE_ACTIVE } from '@/shared/constants/account-disable';
import {
  cancelBroadcast,
  communicationEnvironment,
  createBroadcastDraft,
  createCampaignSegment,
  marketingTopicId,
  scheduleBroadcast,
  sendCommunicationEmail,
  syncMarketingContact,
} from './resend';
import { renderCampaign } from './templates';
import {
  audit,
  CommunicationError,
  DAY,
  digest,
  pageMeta,
  requiredObjectId,
  siteUrl,
  type AdminActor,
  type PageResult,
} from './internal';

type MarketingPreferenceInput = z.infer<typeof marketingPreferenceSchema>;
type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;
type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;

function campaignView(campaign: InstanceType<typeof EmailCampaign>) {
  return {
    id: campaign.id,
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText ?? null,
    topic: campaign.topic,
    status: campaign.status,
    blocks: campaignBlockSchema.array().parse(campaign.blocks),
    locale: campaign.locale ?? null,
    planId: campaign.planId ?? null,
    recipientCount: campaign.recipientCount,
    contentHash: campaign.contentHash,
    testedContentHash: campaign.testedContentHash ?? null,
    testedAt: campaign.testedAt?.toISOString() ?? null,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    sendingStartedAt: campaign.sendingStartedAt?.toISOString() ?? null,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    stoppedAt: campaign.stoppedAt?.toISOString() ?? null,
    stopReason: campaign.stopReason ?? null,
    metrics: { ...campaign.metrics },
    revision: campaign.revision,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export async function getMarketingPreferences(userId: string): Promise<{
  productUpdates: boolean;
  promotions: boolean;
  locale: string | null;
  updatedAt: string | null;
}> {
  await connectDB();
  const preference = await MarketingPreference.findOne({
    userId: requiredObjectId(userId, 'user id'),
  });
  return {
    productUpdates: preference?.productUpdates ?? false,
    promotions: preference?.promotions ?? false,
    locale: preference?.locale ?? null,
    updatedAt: preference?.updatedAt.toISOString() ?? null,
  };
}

export async function updateMarketingPreferences(
  userId: string,
  email: string,
  input: MarketingPreferenceInput,
  ip: string | null,
): Promise<{
  productUpdates: boolean;
  promotions: boolean;
  locale: string | null;
  updatedAt: string;
}> {
  await connectDB();
  const objectId = requiredObjectId(userId, 'user id');
  const [current, contactState] = await Promise.all([
    MarketingPreference.findOne({ userId: objectId }),
    MarketingContactState.findOne({ userId: objectId }),
  ]);
  if (
    contactState &&
    contactState.status !== 'deliverable' &&
    (input.productUpdates || input.promotions)
  ) {
    throw new CommunicationError(
      'email_suppressed',
      'Suppressed email addresses cannot opt in to marketing',
      409,
    );
  }
  const ipHash = ip ? digest(`${communicationEnvironment('AUTH_SECRET')}:${ip}`) : null;
  const events: Array<{ topic: MarketingTopic; action: 'opt_in' | 'opt_out' }> = [];
  if ((current?.productUpdates ?? false) !== input.productUpdates) {
    events.push({ topic: 'product_updates', action: input.productUpdates ? 'opt_in' : 'opt_out' });
  }
  if ((current?.promotions ?? false) !== input.promotions) {
    events.push({ topic: 'promotions', action: input.promotions ? 'opt_in' : 'opt_out' });
  }
  const resendContactId = await syncMarketingContact({
    email,
    productUpdates: input.productUpdates,
    promotions: input.promotions,
  });
  const dbSession = await mongoose.startSession();
  let next: InstanceType<typeof MarketingPreference> | null | undefined;
  try {
    next = await dbSession.withTransaction(async () => {
      const updated = await MarketingPreference.findOneAndUpdate(
        { userId: objectId },
        {
          $set: {
            productUpdates: input.productUpdates,
            promotions: input.promotions,
            ...(input.locale ? { locale: input.locale } : {}),
          },
        },
        { upsert: true, new: true, session: dbSession },
      );
      if (events.length) {
        await MarketingConsentEvent.insertMany(
          events.map((event) => ({
            userId: objectId,
            ...event,
            source: input.source,
            ipHash,
          })),
          { session: dbSession },
        );
      }
      await MarketingContactState.updateOne(
        { userId: objectId },
        {
          $set: { email, resendContactId, lastEventAt: new Date() },
          $setOnInsert: { status: 'deliverable' },
        },
        { upsert: true, session: dbSession },
      );
      return updated;
    });
  } catch (error) {
    try {
      await syncMarketingContact({
        email,
        productUpdates: current?.productUpdates ?? false,
        promotions: current?.promotions ?? false,
      });
    } catch (rollbackError) {
      logger.error(
        { rollbackError, userId },
        'Failed to restore Resend topics after marketing preference transaction failure',
      );
    }
    throw error;
  } finally {
    await dbSession.endSession();
  }
  if (!next) throw new Error('Marketing preference transaction returned no document');
  return {
    productUpdates: next.productUpdates,
    promotions: next.promotions,
    locale: next.locale ?? null,
    updatedAt: next.updatedAt.toISOString(),
  };
}

function campaignContentHash(input: {
  subject: string;
  previewText?: string | null;
  topic: MarketingTopic;
  blocks: z.infer<typeof campaignBlockSchema>[];
}): string {
  return digest(
    JSON.stringify({
      subject: input.subject,
      previewText: input.previewText ?? null,
      topic: input.topic,
      blocks: input.blocks,
    }),
  );
}

/**
 * `createCampaign` and `updateCampaign` both validate the submitted blocks and
 * derive the content hash from the same fields before touching the database;
 * this is the shared parse-and-hash step both call.
 */
function parseCampaignContent(input: CreateCampaignInput): {
  blocks: z.infer<typeof campaignBlockSchema>[];
  contentHash: string;
} {
  const blocks = campaignBlockSchema.array().parse(input.blocks);
  const contentHash = campaignContentHash({
    subject: input.subject,
    previewText: input.previewText ?? null,
    topic: input.topic,
    blocks,
  });
  return { blocks, contentHash };
}

function campaignBlocks(campaign: InstanceType<typeof EmailCampaign>) {
  return campaignBlockSchema.array().parse(campaign.blocks);
}

export async function listCampaigns(
  query: CampaignListQuery,
): Promise<PageResult<ReturnType<typeof campaignView>>> {
  await connectDB();
  const filter: { status?: CampaignStatus } = {};
  if (query.status !== 'all') filter.status = query.status;
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    EmailCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    EmailCampaign.countDocuments(filter),
  ]);
  return {
    items: items.map(campaignView),
    pagination: pageMeta(query.page, query.limit, total),
  };
}

export async function getCampaign(
  id: string,
): Promise<{ campaign: ReturnType<typeof campaignView>; audience: { [key: string]: number } }> {
  await connectDB();
  const campaign = await EmailCampaign.findById(requiredObjectId(id, 'campaign id'));
  if (!campaign) throw new CommunicationError('not_found', 'Campaign not found', 404);
  const audience = await EmailCampaignAudience.aggregate<{
    _id: string;
    count: number;
  }>([
    { $match: { campaignId: campaign._id } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  return {
    campaign: campaignView(campaign),
    audience: Object.fromEntries(audience.map((item) => [item._id, item.count])),
  };
}

export async function createCampaign(
  actor: AdminActor,
  input: CreateCampaignInput,
): ReturnType<typeof getCampaign> {
  await connectDB();
  const { blocks, contentHash } = parseCampaignContent(input);
  const campaign = await EmailCampaign.create({
    name: input.name,
    subject: input.subject,
    previewText: input.previewText ?? null,
    topic: input.topic,
    blocks,
    locale: input.locale ?? null,
    planId: input.planId ?? null,
    status: 'draft',
    contentHash,
    createdBy: requiredObjectId(actor.id, 'actor id'),
  });
  await audit(actor, 'campaign.create', 'email_campaign', campaign.id, { topic: input.topic });
  return getCampaign(campaign.id);
}

export async function updateCampaign(
  id: string,
  actor: AdminActor,
  input: UpdateCampaignInput,
): ReturnType<typeof getCampaign> {
  await connectDB();
  const { blocks, contentHash } = parseCampaignContent(input);
  const campaign = await EmailCampaign.findOneAndUpdate(
    { _id: requiredObjectId(id, 'campaign id'), revision: input.revision, status: 'draft' },
    {
      $set: {
        name: input.name,
        subject: input.subject,
        previewText: input.previewText ?? null,
        topic: input.topic,
        blocks,
        locale: input.locale ?? null,
        planId: input.planId ?? null,
        contentHash,
        testedAt: null,
        testedContentHash: null,
      },
      $inc: { revision: 1 },
    },
    { new: true },
  );
  if (!campaign)
    throw new CommunicationError('conflict', 'Only the current draft can be edited', 409);
  await audit(actor, 'campaign.update', 'email_campaign', campaign.id);
  return getCampaign(campaign.id);
}

/**
 * `testCampaign` and `prepareCampaign` both require the caller to be looking
 * at the current, still-draft revision before doing anything else; this loads
 * the campaign under that guard and throws the caller's own conflict message
 * when the revision or status has moved on.
 */
async function loadDraftCampaignForRevision(
  id: string,
  revision: number,
  conflictMessage: string,
): Promise<InstanceType<typeof EmailCampaign>> {
  await connectDB();
  const campaign = await EmailCampaign.findOne({
    _id: requiredObjectId(id, 'campaign id'),
    revision,
    status: 'draft',
  });
  if (!campaign) throw new CommunicationError('conflict', conflictMessage, 409);
  return campaign;
}

export async function testCampaign(
  id: string,
  actor: AdminActor,
  revision: number,
): ReturnType<typeof getCampaign> {
  const campaign = await loadDraftCampaignForRevision(
    id,
    revision,
    'Campaign changed; reload and retry',
  );
  const rendered = await renderCampaign({
    subject: campaign.subject,
    ...(campaign.previewText ? { previewText: campaign.previewText } : {}),
    blocks: campaignBlocks(campaign),
    preferenceUrl: `${siteUrl()}/profile#email-preferences`,
  });
  const testId = randomUUID();
  await sendCommunicationEmail({
    to: actor.email,
    from: communicationEnvironment('MARKETING_MAIL_FROM'),
    subject: `[TEST] [QC] ${campaign.subject}`,
    ...rendered,
    idempotencyKey: `campaign-test/${campaign.id}/${campaign.contentHash}/${testId}`,
    entityType: 'email_campaign_test',
    entityId: campaign.id,
  });
  campaign.testedAt = new Date();
  campaign.testedContentHash = campaign.contentHash;
  campaign.revision += 1;
  await campaign.save();
  await audit(actor, 'campaign.test', 'email_campaign', campaign.id, {
    recipient: actor.email,
  });
  return getCampaign(campaign.id);
}

export async function prepareCampaign(
  id: string,
  actor: AdminActor,
  revision: number,
): ReturnType<typeof getCampaign> {
  const campaign = await loadDraftCampaignForRevision(
    id,
    revision,
    'Only the current draft can be prepared',
  );
  const preferenceFilter: {
    productUpdates?: boolean;
    promotions?: boolean;
    locale?: string;
  } = campaign.topic === 'product_updates' ? { productUpdates: true } : { promotions: true };
  if (campaign.locale) preferenceFilter.locale = campaign.locale;
  const preferences = await MarketingPreference.find(preferenceFilter).select('userId');
  let eligibleIds = preferences.map((preference) => preference.userId);
  if (campaign.planId && eligibleIds.length) {
    const now = new Date();
    const accounts = await EntitlementAccount.aggregate<{ user: Types.ObjectId }>([
      {
        $match: {
          user: { $in: eligibleIds },
          planId: campaign.planId,
          currentStartAt: { $lte: now },
          $or: [{ perpetual: true }, { currentEndAt: { $gt: now } }],
        },
      },
      { $project: { user: 1 } },
    ]);
    const accountIds = new Set(accounts.map((account) => account.user.toString()));
    eligibleIds = eligibleIds.filter((userId) => accountIds.has(userId.toString()));
  }
  const users = eligibleIds.length
    ? await User.find({
        _id: { $in: eligibleIds },
        disable: ACCOUNT_DISABLE_ACTIVE,
        emailVerified: { $type: 'date' },
      }).select('_id email')
    : [];
  const suppressions = await MarketingContactState.find({
    userId: { $in: users.map((user) => user._id) },
    status: { $ne: 'deliverable' },
  }).select('userId');
  const suppressedIds = new Set(suppressions.map((item) => item.userId.toString()));
  const audience = users.filter((user) => !suppressedIds.has(user.id));
  const segmentId = await createCampaignSegment(`rinkuzu-${campaign.id}-${Date.now()}`);
  await EmailCampaignAudience.deleteMany({ campaignId: campaign._id });
  if (audience.length) {
    await EmailCampaignAudience.insertMany(
      audience.map((user) => ({
        campaignId: campaign._id,
        userId: user._id,
        email: user.email,
        status: 'prepared',
      })),
      { ordered: false },
    );
  }
  campaign.status = audience.length ? 'preparing_audience' : 'ready';
  campaign.recipientCount = audience.length;
  campaign.resendSegmentId = segmentId;
  campaign.revision += 1;
  await campaign.save();
  await audit(actor, 'campaign.prepare', 'email_campaign', campaign.id, {
    recipients: String(audience.length),
  });
  return getCampaign(campaign.id);
}

export async function scheduleCampaign(
  id: string,
  actor: AdminActor,
  input: ScheduleCampaignInput,
): ReturnType<typeof getCampaign> {
  await connectDB();
  const campaign = await EmailCampaign.findOne({
    _id: requiredObjectId(id, 'campaign id'),
    revision: input.revision,
    status: 'ready',
  });
  if (!campaign) throw new CommunicationError('conflict', 'Campaign is not ready or changed', 409);
  if (!campaign.testedAt || campaign.testedContentHash !== campaign.contentHash) {
    throw new CommunicationError('campaign_test_required', 'Send a current test email first', 409);
  }
  if (Date.now() - campaign.testedAt.getTime() > DAY) {
    throw new CommunicationError('campaign_test_expired', 'Test email is older than 24 hours', 409);
  }
  if (input.confirmation !== `GỬI ${campaign.recipientCount}`) {
    throw new CommunicationError(
      'confirmation_mismatch',
      'Campaign confirmation does not match',
      400,
    );
  }
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt.getTime() < Date.now() + 10 * 60 * 1000) {
    throw new CommunicationError(
      'validation_error',
      'Schedule must be at least 10 minutes away',
      400,
    );
  }
  if (!campaign.resendSegmentId) {
    throw new CommunicationError('campaign_not_prepared', 'Campaign segment is missing', 409);
  }
  const rendered = await renderCampaign({
    subject: campaign.subject,
    ...(campaign.previewText ? { previewText: campaign.previewText } : {}),
    blocks: campaignBlocks(campaign),
    preferenceUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
  });
  const claimed = await EmailCampaign.findOneAndUpdate(
    { _id: campaign._id, revision: input.revision, status: 'ready' },
    {
      $set: { status: 'scheduled', scheduledAt, resendBroadcastId: null },
      $inc: { revision: 1 },
    },
    { new: true },
  );
  if (!claimed) throw new CommunicationError('conflict', 'Campaign changed; reload and retry', 409);

  let broadcastId: string | null = null;
  try {
    broadcastId = await createBroadcastDraft({
      name: campaign.name,
      subject: `[QC] ${campaign.subject}`,
      previewText: campaign.previewText,
      ...rendered,
      segmentId: campaign.resendSegmentId,
      topicId: marketingTopicId(campaign.topic),
    });
    const persisted = await EmailCampaign.findOneAndUpdate(
      {
        _id: campaign._id,
        revision: claimed.revision,
        status: 'scheduled',
        resendBroadcastId: null,
      },
      { $set: { resendBroadcastId: broadcastId } },
      { new: true },
    );
    if (!persisted) {
      await cancelBroadcast(broadcastId);
      throw new CommunicationError('conflict', 'Campaign was cancelled while scheduling', 409);
    }
    await scheduleBroadcast(broadcastId, scheduledAt);
  } catch (error) {
    if (broadcastId) {
      try {
        await cancelBroadcast(broadcastId);
      } catch (cleanupError) {
        logger.warn(
          { cleanupError, campaignId: campaign.id, broadcastId },
          'Failed to remove unscheduled broadcast draft',
        );
      }
    }
    await EmailCampaign.updateOne(
      { _id: campaign._id, revision: claimed.revision, status: 'scheduled' },
      {
        $set: { status: 'ready', scheduledAt: null, resendBroadcastId: null },
        $inc: { revision: 1 },
      },
    );
    throw error;
  }
  await audit(actor, 'campaign.schedule', 'email_campaign', campaign.id, {
    recipients: String(campaign.recipientCount),
    scheduledAt: scheduledAt.toISOString(),
  });
  return getCampaign(campaign.id);
}

export async function cancelCampaign(
  id: string,
  actor: AdminActor,
  revision: number,
  reason: string,
): ReturnType<typeof getCampaign> {
  await connectDB();
  const campaign = await EmailCampaign.findOneAndUpdate(
    {
      _id: requiredObjectId(id, 'campaign id'),
      revision,
      status: { $in: ['draft', 'preparing_audience', 'ready', 'scheduled', 'sending'] },
    },
    {
      $set: { status: 'cancelled', stoppedAt: new Date(), stopReason: reason },
      $inc: { revision: 1 },
    },
    { new: true },
  );
  if (!campaign) throw new CommunicationError('conflict', 'Campaign cannot be cancelled', 409);
  if (campaign.resendBroadcastId) {
    try {
      await cancelBroadcast(campaign.resendBroadcastId);
      await EmailCampaign.updateOne(
        { _id: campaign._id, status: 'cancelled', resendBroadcastId: campaign.resendBroadcastId },
        { $set: { resendBroadcastId: null } },
      );
    } catch (error) {
      logger.warn(
        { error, campaignId: campaign.id, broadcastId: campaign.resendBroadcastId },
        'Campaign cancellation will be retried by the worker',
      );
    }
  }
  await audit(actor, 'campaign.cancel', 'email_campaign', campaign.id, { reason });
  return getCampaign(campaign.id);
}
