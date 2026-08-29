import 'server-only';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose, { Types, type ClientSession } from 'mongoose';
import sharp from 'sharp';
import type { WebhookEventPayload } from 'resend';
import type { z } from 'zod';

import { campaignBlockSchema } from '@/dtos/communication';
import type {
  campaignListQuerySchema,
  createCampaignSchema,
  createFeedbackConversationSchema,
  createFeedbackMessageSchema,
  createSupportAttachmentSchema,
  createSupportMessageSchema,
  createSupportTicketSchema,
  feedbackListQuerySchema,
  marketingPreferenceSchema,
  remindFeedbackSchema,
  scheduleCampaignSchema,
  supportListQuerySchema,
  updateCampaignSchema,
  updateSupportTicketSchema,
} from '@/dtos/communication';
import connectDB from '@/lib/mongoose';
import { logger } from '@/lib/logger';
import { publicEnv } from '@/lib/public-env';
import { BUCKET_NAME, s3Client } from '@/lib/s3';
import {
  AdminActionAudit,
  EmailCampaign,
  EmailCampaignAudience,
  EmailDeliveryEvent,
  EmailOutbox,
  FeedbackConversation,
  FeedbackMessage,
  FeedbackOutreachPreference,
  MarketingConsentEvent,
  MarketingContactState,
  MarketingPreference,
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  WebhookEvent,
  type CampaignStatus,
  type FeedbackStatus,
  type MarketingTopic,
  type SupportStatus,
} from '@/models/Communication';
import User from '@/models/User';
import { EntitlementAccount } from '@/models/Billing';
import { ACCOUNT_DISABLE_ACTIVE } from '@/shared/constants/account-disable';
import { canonicalizeEmail } from '@/shared/email/canonical-email';
import {
  addCampaignContact,
  cancelBroadcast,
  communicationEnvironment,
  createBroadcastDraft,
  createCampaignSegment,
  getContactTopics,
  getReceivingEmail,
  marketingTopicId,
  scheduleBroadcast,
  sendCommunicationEmail,
  syncMarketingContact,
} from './resend';
import {
  renderCampaign,
  renderFeedbackInvitation,
  renderFeedbackReply,
  renderSupportNotification,
} from './templates';
import {
  extractFeedbackReplyToken,
  normalizeInboundFeedbackBody,
  parseInboundSenderAddress,
} from './inbound';
import {
  feedbackPreferenceToken,
  feedbackReplyAddress as buildFeedbackReplyAddress,
  feedbackReplyToken,
} from './feedback-address';

type SupportListQuery = z.infer<typeof supportListQuerySchema>;
type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
type CreateSupportMessageInput = z.infer<typeof createSupportMessageSchema>;
type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
type CreateSupportAttachmentInput = z.infer<typeof createSupportAttachmentSchema>;
type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>;
type CreateFeedbackInput = z.infer<typeof createFeedbackConversationSchema>;
type CreateFeedbackMessageInput = z.infer<typeof createFeedbackMessageSchema>;
type RemindFeedbackInput = z.infer<typeof remindFeedbackSchema>;
type MarketingPreferenceInput = z.infer<typeof marketingPreferenceSchema>;
type CampaignListQuery = z.infer<typeof campaignListQuerySchema>;
type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;

export class CommunicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CommunicationError';
  }
}

export interface AdminActor {
  id: string;
  email: string;
}

interface PageResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const DAY = 86_400_000;
const SUPPORT_UPLOAD_ROOT = 'uploads/support_pending';
const SUPPORT_READY_ROOT = 'support/attachments';

function configuredRate(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error(`${name} must be a number greater than 0 and at most 1`);
  }
  return parsed;
}

function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/u, '');
}

function requiredObjectId(value: string, label = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new CommunicationError('validation_error', `Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
}

function pageMeta(page: number, limit: number, total: number): PageResult<never>['pagination'] {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function auditExpiry(): Date {
  return new Date(Date.now() + 5 * 365 * DAY);
}

async function audit(
  actor: AdminActor,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, string> = {},
): Promise<void> {
  await AdminActionAudit.create({
    actorId: requiredObjectId(actor.id, 'actor id'),
    actorEmail: actor.email,
    action,
    entityType,
    entityId,
    details,
    expiresAt: auditExpiry(),
  });
}

function supportTicketView(ticket: InstanceType<typeof SupportTicket>, userEmail?: string) {
  return {
    id: ticket.id,
    userId: ticket.userId.toString(),
    ...(userEmail ? { userEmail } : {}),
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    createdBy: ticket.createdBy,
    lastMessageAt: ticket.lastMessageAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    reopenUntil: ticket.reopenUntil?.toISOString() ?? null,
    canReopen:
      ticket.status === 'closed' &&
      Boolean(ticket.reopenUntil && ticket.reopenUntil.getTime() >= Date.now()),
    revision: ticket.revision,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function feedbackConversationView(conversation: InstanceType<typeof FeedbackConversation>) {
  return {
    id: conversation.id,
    userId: conversation.userId.toString(),
    userEmail: conversation.userEmail,
    subject: conversation.subject,
    status: conversation.status,
    queuedAt: conversation.queuedAt?.toISOString() ?? null,
    sentAt: conversation.sentAt?.toISOString() ?? null,
    repliedAt: conversation.repliedAt?.toISOString() ?? null,
    remindedAt: conversation.remindedAt?.toISOString() ?? null,
    completedAt: conversation.completedAt?.toISOString() ?? null,
    declinedAt: conversation.declinedAt?.toISOString() ?? null,
    expiresAt: conversation.expiresAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    revision: conversation.revision,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

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

async function userEmailMap(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: ids } }).select('_id email');
  return new Map(users.map((user) => [user.id, user.email]));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
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

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Statuses after which no further outreach email may leave the system. */
const CLOSED_FEEDBACK_STATUSES = [
  'declined',
  'opted_out',
  'completed',
  'expired',
  'failed',
] as const satisfies readonly FeedbackStatus[];

/** Statuses an in-flight invitation can still be moved out of by a delivery failure. */
const OPEN_FEEDBACK_STATUSES = [
  'queued',
  'sent',
  'replied',
  'in_conversation',
] as const satisfies readonly FeedbackStatus[];

function isClosedFeedbackStatus(status: FeedbackStatus): boolean {
  return (CLOSED_FEEDBACK_STATUSES as readonly string[]).includes(status);
}

function feedbackToken(conversationId: string): string {
  return feedbackPreferenceToken(conversationId, communicationEnvironment('AUTH_SECRET'));
}

function compactFeedbackReplyToken(conversationId: string): string {
  return feedbackReplyToken(conversationId, communicationEnvironment('AUTH_SECRET'));
}

/**
 * A single preferences link. The page offers both declining this invitation and
 * opting out of all future ones, so one link carries the same control while the
 * email footer stops reading like a newsletter's unsubscribe row. Links already
 * delivered still carry `action=` and the page still honours it.
 */
function feedbackPreferencesUrl(token: string): string {
  return `${siteUrl()}/feedback/preferences?token=${encodeURIComponent(token)}`;
}

function feedbackReplyAddress(token: string): string {
  return buildFeedbackReplyAddress(token, communicationEnvironment('FEEDBACK_REPLY_DOMAIN'));
}

function rejectPromotionalFeedback(subject: string, body: string): void {
  const text = `${subject}\n${body}`.toLowerCase();
  const prohibited = [
    'khuyến mãi',
    'giảm giá',
    'mua ngay',
    'voucher',
    'coupon',
    'discount',
    '% off',
  ];
  if (prohibited.some((term) => text.includes(term))) {
    throw new CommunicationError(
      'validation_error',
      'Feedback outreach cannot contain promotional content; use a campaign instead',
      400,
    );
  }
}

async function queueMail(
  input: {
    kind: 'support_notification' | 'feedback_invitation' | 'feedback_reply' | 'feedback_reminder';
    entityType: 'support_ticket' | 'feedback_conversation';
    entityId: Types.ObjectId;
    to: string;
    from: string;
    replyTo?: string;
    subject: string;
    html: string;
    text: string;
    inReplyTo?: string;
    references?: string[];
    dedupeKey: string;
  },
  session?: ClientSession,
): Promise<void> {
  await EmailOutbox.updateOne(
    { dedupeKey: input.dedupeKey },
    {
      $setOnInsert: {
        ...input,
        references: input.references ?? [],
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
      },
    },
    { upsert: true, ...(session ? { session } : {}) },
  );
}

export async function listSupportTickets(
  userId: string,
  query: SupportListQuery,
  admin: boolean,
): Promise<PageResult<ReturnType<typeof supportTicketView>>> {
  await connectDB();
  const filter: { userId?: Types.ObjectId; status?: SupportStatus } = {};
  if (!admin) filter.userId = requiredObjectId(userId, 'user id');
  if (query.status !== 'all') filter.status = query.status;
  const skip = (query.page - 1) * query.limit;
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(query.limit),
    SupportTicket.countDocuments(filter),
  ]);
  const emails = admin ? await userEmailMap(tickets.map((ticket) => ticket.userId)) : new Map();
  return {
    items: tickets.map((ticket) => supportTicketView(ticket, emails.get(ticket.userId.toString()))),
    pagination: pageMeta(query.page, query.limit, total),
  };
}

export async function getSupportTicket(ticketId: string, userId: string, admin: boolean) {
  await connectDB();
  const ticket = await SupportTicket.findById(requiredObjectId(ticketId, 'ticket id'));
  if (!ticket || (!admin && ticket.userId.toString() !== userId)) {
    throw new CommunicationError('not_found', 'Support ticket not found', 404);
  }
  const [messages, email] = await Promise.all([
    SupportMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 }),
    User.findById(ticket.userId).select('email'),
  ]);
  const attachmentIds = messages.flatMap((message) => message.attachmentIds);
  const attachments = attachmentIds.length
    ? await SupportAttachment.find({ _id: { $in: attachmentIds }, status: 'ready' })
    : [];
  const attachmentMap = new Map(
    await Promise.all(
      attachments.map(
        async (attachment) =>
          [
            attachment.id,
            {
              id: attachment.id,
              contentType: attachment.contentType,
              size: attachment.size,
              width: attachment.width ?? null,
              height: attachment.height ?? null,
              url: await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.storageKey }),
                { expiresIn: 300 },
              ),
            },
          ] as const,
      ),
    ),
  );
  return {
    ticket: supportTicketView(ticket, email?.email),
    messages: messages.map((message) => ({
      id: message.id,
      authorUserId: message.authorUserId.toString(),
      authorRole: message.authorRole,
      body: message.body,
      attachments: message.attachmentIds
        .map((id) => attachmentMap.get(id.toString()))
        .filter((item) => item !== undefined),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function createSupportAttachmentUpload(
  userId: string,
  input: CreateSupportAttachmentInput,
) {
  await connectDB();
  const owner = requiredObjectId(userId, 'user id');
  const attachmentId = new Types.ObjectId();
  const safeExtension =
    input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const storageKey = `${SUPPORT_UPLOAD_ROOT}/${userId}/${attachmentId.toString()}.${safeExtension}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await SupportAttachment.create({
    _id: attachmentId,
    ownerUserId: owner,
    storageKey,
    status: 'pending',
    contentType: input.contentType,
    size: input.fileSize,
    expiresAt,
  });
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ContentType: input.contentType,
      ContentLength: input.fileSize,
      CacheControl: 'private, no-store, max-age=0',
    }),
    { expiresIn: 300 },
  );
  return {
    attachmentId: attachmentId.toString(),
    uploadUrl,
    uploadMethod: 'PUT' as const,
    uploadHeaders: { 'Content-Type': input.contentType },
    expiresAt: expiresAt.toISOString(),
  };
}

async function finalizeSupportAttachments(
  userId: string,
  attachmentIds: string[],
): Promise<Types.ObjectId[]> {
  const ids = attachmentIds.map((id) => requiredObjectId(id, 'attachment id'));
  if (!ids.length) return [];
  const attachments = await SupportAttachment.find({ _id: { $in: ids } });
  if (attachments.length !== ids.length) {
    throw new CommunicationError('validation_error', 'One or more attachments do not exist', 400);
  }
  const finalized: Types.ObjectId[] = [];
  for (const attachment of attachments) {
    if (attachment.ownerUserId.toString() !== userId) {
      throw new CommunicationError('forbidden', 'Attachment belongs to another user', 403);
    }
    if (attachment.status === 'ready') {
      finalized.push(attachment._id);
      continue;
    }
    if (!attachment.expiresAt || attachment.expiresAt.getTime() <= Date.now()) {
      throw new CommunicationError('validation_error', 'Attachment upload expired', 400);
    }
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.storageKey }),
    );
    if (!object.Body)
      throw new CommunicationError('validation_error', 'Attachment upload is empty', 400);
    const bytes = await object.Body.transformToByteArray();
    if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) {
      throw new CommunicationError('validation_error', 'Attachment size is invalid', 400);
    }
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      !['png', 'jpeg', 'webp'].includes(metadata.format ?? '')
    ) {
      throw new CommunicationError('validation_error', 'Attachment is not a supported image', 400);
    }
    const output = await image
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    const readyKey = `${SUPPORT_READY_ROOT}/${userId}/${attachment.id}.webp`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: readyKey,
        Body: output.data,
        ContentType: 'image/webp',
        CacheControl: 'private, no-store, max-age=0',
      }),
    );
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: attachment.storageKey }),
    );
    attachment.storageKey = readyKey;
    attachment.status = 'ready';
    attachment.contentType = 'image/webp';
    attachment.size = output.data.byteLength;
    attachment.width = output.info.width;
    attachment.height = output.info.height;
    await attachment.save();
    finalized.push(attachment._id);
  }
  return finalized;
}

export async function createSupportTicket(
  actorId: string,
  actorEmail: string,
  input: CreateSupportTicketInput,
  admin: boolean,
) {
  await connectDB();
  const targetUserId = admin && input.userId ? input.userId : actorId;
  const target = await User.findOne({
    _id: requiredObjectId(targetUserId, 'user id'),
    disable: ACCOUNT_DISABLE_ACTIVE,
  }).select('email');
  if (!target) throw new CommunicationError('not_found', 'User not found', 404);
  const duplicate = await SupportMessage.findOne({
    authorUserId: requiredObjectId(actorId, 'actor id'),
    clientMessageId: input.clientMessageId,
  });
  if (duplicate) return getSupportTicket(duplicate.ticketId.toString(), actorId, admin);
  const dayAgo = new Date(Date.now() - DAY);
  const recentCount = await SupportTicket.countDocuments({
    userId: target._id,
    createdAt: { $gte: dayAgo },
  });
  if (recentCount >= 5) {
    throw new CommunicationError('rate_limit_exceeded', 'Maximum 5 support tickets per day', 429);
  }
  const attachments = await finalizeSupportAttachments(actorId, input.attachmentIds);
  const now = new Date();
  const ticketId = new Types.ObjectId();
  const messageId = new Types.ObjectId();
  const notification = admin
    ? await renderSupportNotification({
        subject: input.subject,
        messagePreview: input.body.slice(0, 300),
        ticketUrl: `${siteUrl()}/support/${ticketId.toString()}`,
      })
    : null;
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await SupportTicket.create(
        [
          {
            _id: ticketId,
            userId: target._id,
            subject: input.subject,
            category: input.category,
            status: admin ? 'waiting_for_user' : 'waiting_for_admin',
            priority: 'normal',
            createdBy: admin ? 'admin' : 'user',
            ...(admin ? { assignedAdminId: requiredObjectId(actorId, 'actor id') } : {}),
            lastMessageAt: now,
          },
        ],
        { session: dbSession },
      );
      await SupportMessage.create(
        [
          {
            _id: messageId,
            ticketId,
            authorUserId: requiredObjectId(actorId, 'actor id'),
            authorRole: admin ? 'admin' : 'user',
            body: input.body,
            attachmentIds: attachments,
            clientMessageId: input.clientMessageId,
          },
        ],
        { session: dbSession },
      );
      if (attachments.length) {
        const claimed = await SupportAttachment.updateMany(
          {
            _id: { $in: attachments },
            ownerUserId: requiredObjectId(actorId, 'actor id'),
            status: 'ready',
            ticketId: null,
            messageId: null,
          },
          { $set: { ticketId, messageId, expiresAt: null } },
          { session: dbSession },
        );
        if (claimed.modifiedCount !== attachments.length) {
          throw new CommunicationError(
            'conflict',
            'One or more attachments were already used',
            409,
          );
        }
      }
      if (admin && notification) {
        await queueMail(
          {
            kind: 'support_notification',
            entityType: 'support_ticket',
            entityId: ticketId,
            to: target.email,
            from: communicationEnvironment('SUPPORT_MAIL_FROM'),
            subject: `RinKuzu Support: ${input.subject}`,
            ...notification,
            dedupeKey: `support/${ticketId.toString()}/message/${messageId.toString()}`,
          },
          dbSession,
        );
        await AdminActionAudit.create(
          [
            {
              actorId: requiredObjectId(actorId, 'actor id'),
              actorEmail,
              action: 'support.create_for_user',
              entityType: 'support_ticket',
              entityId: ticketId.toString(),
              details: {},
              expiresAt: auditExpiry(),
            },
          ],
          { session: dbSession },
        );
      }
    });
  } finally {
    await dbSession.endSession();
  }
  return getSupportTicket(ticketId.toString(), actorId, admin);
}

export async function addSupportMessage(
  ticketId: string,
  actorId: string,
  actorEmail: string,
  input: CreateSupportMessageInput,
  admin: boolean,
) {
  await connectDB();
  const ticket = await SupportTicket.findById(requiredObjectId(ticketId, 'ticket id'));
  if (!ticket || (!admin && ticket.userId.toString() !== actorId)) {
    throw new CommunicationError('not_found', 'Support ticket not found', 404);
  }
  const existing = await SupportMessage.findOne({
    ticketId: ticket._id,
    clientMessageId: input.clientMessageId,
  });
  if (existing) return getSupportTicket(ticket.id, actorId, admin);
  if (ticket.status === 'closed') {
    throw new CommunicationError(
      'conflict',
      'Closed tickets must be reopened before replying',
      409,
    );
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (
    (await SupportMessage.countDocuments({ ticketId: ticket._id, createdAt: { $gte: hourAgo } })) >=
    30
  ) {
    throw new CommunicationError('rate_limit_exceeded', 'Maximum 30 messages per hour', 429);
  }
  const attachments = await finalizeSupportAttachments(actorId, input.attachmentIds);
  const recipient = admin
    ? ((await User.findById(ticket.userId).select('email'))?.email ?? null)
    : process.env['SUPPORT_ADMIN_EMAIL']?.trim() || null;
  const rendered = recipient
    ? await renderSupportNotification({
        subject: ticket.subject,
        messagePreview: input.body.slice(0, 300),
        ticketUrl: `${siteUrl()}/support/${ticket.id}`,
      })
    : null;
  const messageId = new Types.ObjectId();
  const messageCreatedAt = new Date();
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await SupportMessage.create(
        [
          {
            _id: messageId,
            ticketId: ticket._id,
            authorUserId: requiredObjectId(actorId, 'actor id'),
            authorRole: admin ? 'admin' : 'user',
            body: input.body,
            attachmentIds: attachments,
            clientMessageId: input.clientMessageId,
            createdAt: messageCreatedAt,
          },
        ],
        { session: dbSession },
      );
      const updated = await SupportTicket.updateOne(
        { _id: ticket._id, revision: ticket.revision, status: { $ne: 'closed' } },
        {
          $set: {
            status: admin ? 'waiting_for_user' : 'waiting_for_admin',
            lastMessageAt: messageCreatedAt,
          },
          $inc: { revision: 1 },
        },
        { session: dbSession },
      );
      if (updated.modifiedCount !== 1) {
        throw new CommunicationError('conflict', 'Ticket changed; reload and retry', 409);
      }
      if (attachments.length) {
        const claimed = await SupportAttachment.updateMany(
          {
            _id: { $in: attachments },
            ownerUserId: requiredObjectId(actorId, 'actor id'),
            status: 'ready',
            ticketId: null,
            messageId: null,
          },
          { $set: { ticketId: ticket._id, messageId, expiresAt: null } },
          { session: dbSession },
        );
        if (claimed.modifiedCount !== attachments.length) {
          throw new CommunicationError(
            'conflict',
            'One or more attachments were already used',
            409,
          );
        }
      }
      if (recipient && rendered) {
        await queueMail(
          {
            kind: 'support_notification',
            entityType: 'support_ticket',
            entityId: ticket._id,
            to: recipient,
            from: communicationEnvironment('SUPPORT_MAIL_FROM'),
            subject: `RinKuzu Support: ${ticket.subject}`,
            ...rendered,
            dedupeKey: `support/${ticket.id}/message/${messageId.toString()}`,
          },
          dbSession,
        );
      }
      if (admin) {
        await AdminActionAudit.create(
          [
            {
              actorId: requiredObjectId(actorId, 'actor id'),
              actorEmail,
              action: 'support.reply',
              entityType: 'support_ticket',
              entityId: ticket.id,
              details: {},
              expiresAt: auditExpiry(),
            },
          ],
          { session: dbSession },
        );
      }
    });
  } finally {
    await dbSession.endSession();
  }
  return getSupportTicket(ticket.id, actorId, admin);
}

export async function updateSupportTicket(
  ticketId: string,
  actor: AdminActor,
  input: UpdateSupportTicketInput,
) {
  await connectDB();
  const now = new Date();
  const set: {
    status: SupportStatus;
    priority?: 'normal' | 'high';
    resolvedAt?: Date | null;
    closedAt?: Date | null;
    reopenUntil?: Date | null;
  } = { status: input.status };
  if (input.priority) set.priority = input.priority;
  if (input.status === 'resolved') set.resolvedAt = now;
  if (input.status === 'closed') {
    set.closedAt = now;
    set.reopenUntil = new Date(now.getTime() + 7 * DAY);
  }
  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: requiredObjectId(ticketId, 'ticket id'), revision: input.revision },
    { $set: set, $inc: { revision: 1 } },
    { new: true },
  );
  if (!ticket) throw new CommunicationError('conflict', 'Ticket changed; reload and retry', 409);
  await audit(actor, 'support.status_update', 'support_ticket', ticket.id, {
    status: input.status,
  });
  return supportTicketView(ticket);
}

export async function reopenSupportTicket(ticketId: string, userId: string) {
  await connectDB();
  const ticket = await SupportTicket.findOne({
    _id: requiredObjectId(ticketId, 'ticket id'),
    userId: requiredObjectId(userId, 'user id'),
  });
  if (!ticket) throw new CommunicationError('not_found', 'Support ticket not found', 404);
  if (
    ticket.status !== 'closed' ||
    !ticket.reopenUntil ||
    ticket.reopenUntil.getTime() < Date.now()
  ) {
    throw new CommunicationError('conflict', 'This ticket can no longer be reopened', 409);
  }
  ticket.status = 'waiting_for_admin';
  ticket.closedAt = null;
  ticket.reopenUntil = null;
  ticket.revision += 1;
  await ticket.save();
  return supportTicketView(ticket);
}

export async function listFeedback(
  query: FeedbackListQuery,
): Promise<PageResult<ReturnType<typeof feedbackConversationView>>> {
  await connectDB();
  const filter: { status?: FeedbackStatus; userId?: Types.ObjectId } = {};
  if (query.status !== 'all') filter.status = query.status;
  if (query.userId) filter.userId = requiredObjectId(query.userId, 'user id');
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    FeedbackConversation.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(query.limit),
    FeedbackConversation.countDocuments(filter),
  ]);
  return {
    items: items.map(feedbackConversationView),
    pagination: pageMeta(query.page, query.limit, total),
  };
}

export async function getFeedback(id: string) {
  await connectDB();
  const conversation = await FeedbackConversation.findById(requiredObjectId(id));
  if (!conversation)
    throw new CommunicationError('not_found', 'Feedback conversation not found', 404);
  const messages = await FeedbackMessage.find({ conversationId: conversation._id }).sort({
    createdAt: 1,
  });
  return {
    conversation: feedbackConversationView(conversation),
    messages: messages.map((message) => ({
      id: message.id,
      direction: message.direction,
      source: message.source,
      body: message.body,
      hasAttachments: message.hasAttachments,
      emailId: message.emailId ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export async function createFeedback(actor: AdminActor, input: CreateFeedbackInput) {
  await connectDB();
  rejectPromotionalFeedback(input.subject, input.body);
  const userId = requiredObjectId(input.userId, 'user id');
  const user = await User.findOne({
    _id: userId,
    disable: ACCOUNT_DISABLE_ACTIVE,
    emailVerified: { $type: 'date' },
  }).select('email');
  if (!user) throw new CommunicationError('not_found', 'Eligible verified user not found', 404);
  const [preference, contactState] = await Promise.all([
    FeedbackOutreachPreference.findOne({ userId }),
    MarketingContactState.findOne({ userId }),
  ]);
  if (preference?.optedOutAt) {
    throw new CommunicationError('feedback_opted_out', 'User opted out of feedback outreach', 409);
  }
  if (contactState && contactState.status !== 'deliverable') {
    throw new CommunicationError('email_suppressed', 'User email is not deliverable', 409);
  }
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY);
  if (
    await FeedbackConversation.exists({
      userId,
      createdAt: { $gte: ninetyDaysAgo },
      status: { $nin: ['draft', 'failed'] },
    })
  ) {
    throw new CommunicationError(
      'feedback_frequency_limit',
      'User was invited in the last 90 days',
      429,
    );
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (
    (await FeedbackConversation.countDocuments({
      createdAt: { $gte: today },
      status: { $nin: ['draft', 'failed'] },
    })) >= 20
  ) {
    throw new CommunicationError(
      'rate_limit_exceeded',
      'Daily feedback invitation limit reached',
      429,
    );
  }
  const conversationId = new Types.ObjectId();
  const messageId = new Types.ObjectId();
  const token = feedbackToken(conversationId.toString());
  const tokenHash = digest(token);
  const replyToken = compactFeedbackReplyToken(conversationId.toString());
  const now = new Date();
  const rendered = await renderFeedbackInvitation({
    body: input.body,
    preferencesUrl: feedbackPreferencesUrl(token),
  });
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await FeedbackConversation.create(
        [
          {
            _id: conversationId,
            userId,
            userEmail: user.email,
            subject: input.subject,
            status: 'queued',
            replyTokenHash: tokenHash,
            replyAddressTokenHash: digest(replyToken),
            createdBy: requiredObjectId(actor.id, 'actor id'),
            queuedAt: now,
            expiresAt: new Date(now.getTime() + 30 * DAY),
            lastMessageAt: now,
          },
        ],
        { session: dbSession },
      );
      await FeedbackMessage.create(
        [
          {
            _id: messageId,
            conversationId,
            direction: 'outbound',
            source: 'admin_app',
            body: input.body,
            hasAttachments: false,
            clientMessageId: input.clientMessageId,
          },
        ],
        { session: dbSession },
      );
      await queueMail(
        {
          kind: 'feedback_invitation',
          entityType: 'feedback_conversation',
          entityId: conversationId,
          to: user.email,
          from: communicationEnvironment('FEEDBACK_MAIL_FROM'),
          replyTo: feedbackReplyAddress(replyToken),
          subject: input.subject,
          ...rendered,
          dedupeKey: `feedback/${conversationId.toString()}/message/${messageId.toString()}`,
        },
        dbSession,
      );
      await AdminActionAudit.create(
        [
          {
            actorId: requiredObjectId(actor.id, 'actor id'),
            actorEmail: actor.email,
            action: 'feedback.invite',
            entityType: 'feedback_conversation',
            entityId: conversationId.toString(),
            details: { userId: input.userId },
            expiresAt: auditExpiry(),
          },
        ],
        { session: dbSession },
      );
    });
  } finally {
    await dbSession.endSession();
  }
  return getFeedback(conversationId.toString());
}

export async function addFeedbackMessage(
  id: string,
  actor: AdminActor,
  input: CreateFeedbackMessageInput,
) {
  await connectDB();
  rejectPromotionalFeedback('', input.body);
  const conversation = await FeedbackConversation.findById(requiredObjectId(id));
  if (!conversation)
    throw new CommunicationError('not_found', 'Feedback conversation not found', 404);
  const existing = await FeedbackMessage.findOne({
    conversationId: conversation._id,
    clientMessageId: input.clientMessageId,
  });
  if (existing) return getFeedback(conversation.id);
  if (isClosedFeedbackStatus(conversation.status)) {
    throw new CommunicationError('conflict', 'Feedback conversation is not open', 409);
  }
  if (conversation.status === 'queued') {
    throw new CommunicationError('conflict', 'Wait until the invitation email is sent', 409);
  }
  const token = feedbackToken(conversation.id);
  const replyToken = compactFeedbackReplyToken(conversation.id);
  const rendered = await renderFeedbackReply({
    body: input.body,
    preferencesUrl: feedbackPreferencesUrl(token),
  });
  const messageId = new Types.ObjectId();
  const messageCreatedAt = new Date();
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await FeedbackMessage.create(
        [
          {
            _id: messageId,
            conversationId: conversation._id,
            direction: 'outbound',
            source: 'admin_app',
            body: input.body,
            hasAttachments: false,
            clientMessageId: input.clientMessageId,
            inReplyTo: conversation.lastMessageIdHeader ?? null,
            createdAt: messageCreatedAt,
          },
        ],
        { session: dbSession },
      );
      const updated = await FeedbackConversation.updateOne(
        {
          _id: conversation._id,
          revision: conversation.revision,
          status: { $nin: CLOSED_FEEDBACK_STATUSES },
        },
        {
          $set: {
            status: 'in_conversation',
            lastMessageAt: messageCreatedAt,
            replyAddressTokenHash: digest(replyToken),
          },
          $inc: { revision: 1 },
        },
        { session: dbSession },
      );
      if (updated.modifiedCount !== 1) {
        throw new CommunicationError('conflict', 'Conversation changed; reload and retry', 409);
      }
      await queueMail(
        {
          kind: 'feedback_reply',
          entityType: 'feedback_conversation',
          entityId: conversation._id,
          to: conversation.userEmail,
          from: communicationEnvironment('FEEDBACK_MAIL_FROM'),
          replyTo: feedbackReplyAddress(replyToken),
          subject: `Re: ${conversation.subject.replace(/^Re:\s*/iu, '')}`,
          ...rendered,
          ...(conversation.lastMessageIdHeader
            ? { inReplyTo: conversation.lastMessageIdHeader }
            : {}),
          references: conversation.references,
          dedupeKey: `feedback/${conversation.id}/message/${messageId.toString()}`,
        },
        dbSession,
      );
      await AdminActionAudit.create(
        [
          {
            actorId: requiredObjectId(actor.id, 'actor id'),
            actorEmail: actor.email,
            action: 'feedback.reply',
            entityType: 'feedback_conversation',
            entityId: conversation.id,
            details: {},
            expiresAt: auditExpiry(),
          },
        ],
        { session: dbSession },
      );
    });
  } finally {
    await dbSession.endSession();
  }
  return getFeedback(conversation.id);
}

export async function remindFeedback(id: string, actor: AdminActor, input: RemindFeedbackInput) {
  await connectDB();
  const conversation = await FeedbackConversation.findById(requiredObjectId(id));
  if (!conversation)
    throw new CommunicationError('not_found', 'Feedback conversation not found', 404);
  const existing = await FeedbackMessage.findOne({
    conversationId: conversation._id,
    clientMessageId: input.clientMessageId,
  });
  if (existing) return getFeedback(conversation.id);
  if (conversation.status !== 'sent' || !conversation.sentAt) {
    throw new CommunicationError('conflict', 'Only unanswered invitations can be reminded', 409);
  }
  if (conversation.remindedAt)
    throw new CommunicationError('conflict', 'Reminder already sent', 409);
  if (Date.now() - conversation.sentAt.getTime() < 7 * DAY) {
    throw new CommunicationError('conflict', 'Wait at least 7 days before reminding', 409);
  }
  const body =
    input.body ??
    'Mình xin phép nhắc lại lời mời chia sẻ trải nghiệm trước đó. Nếu không tiện, bạn không cần trả lời.';
  const token = feedbackToken(conversation.id);
  const replyToken = compactFeedbackReplyToken(conversation.id);
  const rendered = await renderFeedbackInvitation({
    body,
    preferencesUrl: feedbackPreferencesUrl(token),
    reminder: true,
  });
  const messageId = new Types.ObjectId();
  const messageCreatedAt = new Date();
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await FeedbackMessage.create(
        [
          {
            _id: messageId,
            conversationId: conversation._id,
            direction: 'outbound',
            source: 'admin_app',
            body,
            hasAttachments: false,
            clientMessageId: input.clientMessageId,
            createdAt: messageCreatedAt,
          },
        ],
        { session: dbSession },
      );
      const updated = await FeedbackConversation.updateOne(
        {
          _id: conversation._id,
          revision: conversation.revision,
          status: 'sent',
          remindedAt: null,
        },
        {
          $set: {
            remindedAt: messageCreatedAt,
            lastMessageAt: messageCreatedAt,
            replyAddressTokenHash: digest(replyToken),
          },
          $inc: { revision: 1 },
        },
        { session: dbSession },
      );
      if (updated.modifiedCount !== 1) {
        throw new CommunicationError('conflict', 'Conversation changed; reload and retry', 409);
      }
      await queueMail(
        {
          kind: 'feedback_reminder',
          entityType: 'feedback_conversation',
          entityId: conversation._id,
          to: conversation.userEmail,
          from: communicationEnvironment('FEEDBACK_MAIL_FROM'),
          replyTo: feedbackReplyAddress(replyToken),
          subject: `Re: ${conversation.subject.replace(/^Re:\s*/iu, '')}`,
          ...rendered,
          ...(conversation.lastMessageIdHeader
            ? { inReplyTo: conversation.lastMessageIdHeader }
            : {}),
          references: conversation.references,
          dedupeKey: `feedback/${conversation.id}/message/${messageId.toString()}`,
        },
        dbSession,
      );
      await AdminActionAudit.create(
        [
          {
            actorId: requiredObjectId(actor.id, 'actor id'),
            actorEmail: actor.email,
            action: 'feedback.remind',
            entityType: 'feedback_conversation',
            entityId: conversation.id,
            details: {},
            expiresAt: auditExpiry(),
          },
        ],
        { session: dbSession },
      );
    });
  } finally {
    await dbSession.endSession();
  }
  return getFeedback(conversation.id);
}

export async function completeFeedback(id: string, actor: AdminActor, revision: number) {
  await connectDB();
  const conversation = await FeedbackConversation.findOneAndUpdate(
    {
      _id: requiredObjectId(id),
      revision,
      status: { $nin: CLOSED_FEEDBACK_STATUSES },
    },
    { $set: { status: 'completed', completedAt: new Date() }, $inc: { revision: 1 } },
    { new: true },
  );
  if (!conversation)
    throw new CommunicationError('conflict', 'Conversation changed or is closed', 409);
  await cancelQueuedFeedbackMail([conversation._id]);
  await audit(actor, 'feedback.complete', 'feedback_conversation', conversation.id);
  return feedbackConversationView(conversation);
}

export async function applyFeedbackPreference(token: string, action: 'decline' | 'opt_out') {
  await connectDB();
  const conversation = await FeedbackConversation.findOne({ replyTokenHash: digest(token) });
  if (!conversation) throw new CommunicationError('invalid_token', 'Feedback link is invalid', 404);
  const now = new Date();
  if (action === 'opt_out') {
    await FeedbackOutreachPreference.updateOne(
      { userId: conversation.userId },
      { $set: { optedOutAt: now, reason: 'user_opt_out' } },
      { upsert: true },
    );
    const openStatuses = ['draft', ...OPEN_FEEDBACK_STATUSES];
    const affected = await FeedbackConversation.find({
      userId: conversation.userId,
      status: { $in: openStatuses },
    }).select('_id');
    const affectedIds = affected.map((entry) => entry._id);
    await FeedbackConversation.updateMany(
      // The ids come from a separate read, so the write repeats the status
      // predicate: a conversation completed in between must not be reopened
      // into `opted_out`.
      { _id: { $in: affectedIds }, status: { $in: openStatuses } },
      { $set: { status: 'opted_out', declinedAt: now }, $inc: { revision: 1 } },
    );
    await cancelQueuedFeedbackMail(affectedIds);
  } else if (!['completed', 'opted_out'].includes(conversation.status)) {
    conversation.status = 'declined';
    conversation.declinedAt = now;
    conversation.revision += 1;
    await conversation.save();
    await cancelQueuedFeedbackMail([conversation._id]);
  }
  return { action, applied: true };
}

/**
 * Stop invitations that have not left the queue yet. Cancelling the row keeps
 * the queue depth honest instead of letting a doomed email retry for hours; the
 * worker performs the same check again immediately before sending, so a race
 * cannot slip an email past an opt-out.
 */
async function cancelQueuedFeedbackMail(conversationIds: Types.ObjectId[]): Promise<number> {
  if (!conversationIds.length) return 0;
  const canceled = await EmailOutbox.updateMany(
    {
      entityType: 'feedback_conversation',
      entityId: { $in: conversationIds },
      status: 'pending',
    },
    { $set: { status: 'canceled', lastError: 'conversation_closed' } },
  );
  return canceled.modifiedCount;
}

export async function getMarketingPreferences(userId: string) {
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
) {
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

export async function getCampaign(id: string) {
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

export async function createCampaign(actor: AdminActor, input: CreateCampaignInput) {
  await connectDB();
  const blocks = campaignBlockSchema.array().parse(input.blocks);
  const contentHash = campaignContentHash({
    subject: input.subject,
    previewText: input.previewText ?? null,
    topic: input.topic,
    blocks,
  });
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

export async function updateCampaign(id: string, actor: AdminActor, input: UpdateCampaignInput) {
  await connectDB();
  const blocks = campaignBlockSchema.array().parse(input.blocks);
  const contentHash = campaignContentHash({
    subject: input.subject,
    previewText: input.previewText ?? null,
    topic: input.topic,
    blocks,
  });
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

export async function testCampaign(id: string, actor: AdminActor, revision: number) {
  await connectDB();
  const campaign = await EmailCampaign.findOne({
    _id: requiredObjectId(id, 'campaign id'),
    revision,
    status: 'draft',
  });
  if (!campaign)
    throw new CommunicationError('conflict', 'Campaign changed; reload and retry', 409);
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

export async function prepareCampaign(id: string, actor: AdminActor, revision: number) {
  await connectDB();
  const campaign = await EmailCampaign.findOne({
    _id: requiredObjectId(id, 'campaign id'),
    revision,
    status: 'draft',
  });
  if (!campaign)
    throw new CommunicationError('conflict', 'Only the current draft can be prepared', 409);
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
) {
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
) {
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
  return { status: 'processed' as const, conversationId: conversation.id };
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
) {
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
      },
      {
        $set: {
          status: 'processing',
          leaseToken,
          leaseUntil: new Date(now.getTime() + 2 * 60 * 1000),
        },
        $inc: { attempts: 1 },
      },
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
      const externalEmailId = await sendCommunicationEmail({
        to: item.to,
        from: item.from,
        replyTo: item.replyTo,
        subject: item.subject,
        html: item.html,
        text: item.text,
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
          $set: { status: 'completed', externalEmailId },
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
        {
          $set: {
            status: 'processing',
            leaseToken,
            leaseUntil: new Date(now.getTime() + 2 * 60 * 1000),
          },
          $inc: { attempts: 1 },
        },
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

export async function runCommunicationWorker(limit = 50) {
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

export async function communicationHealth() {
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
