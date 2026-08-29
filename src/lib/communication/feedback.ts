import 'server-only';

import mongoose, { Types } from 'mongoose';
import type { z } from 'zod';

import {
  createFeedbackConversationSchema,
  createFeedbackMessageSchema,
  feedbackListQuerySchema,
  remindFeedbackSchema,
} from '@/dtos/communication';
import connectDB from '@/lib/mongoose';
import {
  AdminActionAudit,
  FeedbackConversation,
  FeedbackMessage,
  FeedbackOutreachPreference,
  MarketingContactState,
  type FeedbackStatus,
} from '@/models/Communication';
import User from '@/models/User';
import { ACCOUNT_DISABLE_ACTIVE } from '@/shared/constants/account-disable';
import { communicationEnvironment } from './resend';
import {
  renderFeedbackInvitation,
  renderFeedbackReply,
  type RenderedCommunicationMail,
} from './templates';
import { feedbackPreferenceToken } from './feedback-address';
import {
  audit,
  auditExpiry,
  cancelQueuedFeedbackMail,
  CLOSED_FEEDBACK_STATUSES,
  CommunicationError,
  compactFeedbackReplyToken,
  DAY,
  digest,
  feedbackReplyAddress,
  isClosedFeedbackStatus,
  OPEN_FEEDBACK_STATUSES,
  pageMeta,
  queueMail,
  requiredObjectId,
  siteUrl,
  type AdminActor,
  type PageResult,
} from './internal';

type FeedbackListQuery = z.infer<typeof feedbackListQuerySchema>;
type CreateFeedbackInput = z.infer<typeof createFeedbackConversationSchema>;
type CreateFeedbackMessageInput = z.infer<typeof createFeedbackMessageSchema>;
type RemindFeedbackInput = z.infer<typeof remindFeedbackSchema>;

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

function feedbackToken(conversationId: string): string {
  return feedbackPreferenceToken(conversationId, communicationEnvironment('AUTH_SECRET'));
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

function feedbackMessageView(message: InstanceType<typeof FeedbackMessage>) {
  return {
    id: message.id,
    direction: message.direction,
    source: message.source,
    body: message.body,
    hasAttachments: message.hasAttachments,
    emailId: message.emailId ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getFeedback(id: string): Promise<{
  conversation: ReturnType<typeof feedbackConversationView>;
  messages: ReturnType<typeof feedbackMessageView>[];
}> {
  await connectDB();
  const conversation = await FeedbackConversation.findById(requiredObjectId(id));
  if (!conversation)
    throw new CommunicationError('not_found', 'Feedback conversation not found', 404);
  const messages = await FeedbackMessage.find({ conversationId: conversation._id }).sort({
    createdAt: 1,
  });
  return {
    conversation: feedbackConversationView(conversation),
    messages: messages.map(feedbackMessageView),
  };
}

export async function createFeedback(
  actor: AdminActor,
  input: CreateFeedbackInput,
): ReturnType<typeof getFeedback> {
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

/**
 * Common mail-composition-and-queueing tail shared by `addFeedbackMessage` and
 * `remindFeedback`: append the outbound message, transition the conversation,
 * queue the provider send, and audit the action — all inside one session so a
 * partial write can never leave the conversation and the outbox disagreeing.
 * `kind` carries every place the two callers actually diverge (the message's
 * `inReplyTo`, the conversation filter/transition, the mail kind, and the audit
 * action); everything else here is byte-for-byte identical between the two.
 */
async function queueFeedbackReplyMail(
  conversation: InstanceType<typeof FeedbackConversation>,
  actor: AdminActor,
  body: string,
  clientMessageId: string,
  rendered: RenderedCommunicationMail,
  kind: 'reply' | 'reminder',
): ReturnType<typeof getFeedback> {
  const replyToken = compactFeedbackReplyToken(conversation.id);
  const messageId = new Types.ObjectId();
  const messageCreatedAt = new Date();
  const conversationFilter =
    kind === 'reply'
      ? {
          _id: conversation._id,
          revision: conversation.revision,
          status: { $nin: CLOSED_FEEDBACK_STATUSES },
        }
      : {
          _id: conversation._id,
          revision: conversation.revision,
          status: 'sent' as const,
          remindedAt: null,
        };
  const conversationSet =
    kind === 'reply' ? { status: 'in_conversation' as const } : { remindedAt: messageCreatedAt };
  const mailKind = kind === 'reply' ? ('feedback_reply' as const) : ('feedback_reminder' as const);
  const auditAction = kind === 'reply' ? 'feedback.reply' : 'feedback.remind';
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
            clientMessageId,
            ...(kind === 'reply' ? { inReplyTo: conversation.lastMessageIdHeader ?? null } : {}),
            createdAt: messageCreatedAt,
          },
        ],
        { session: dbSession },
      );
      const updated = await FeedbackConversation.updateOne(
        conversationFilter,
        {
          $set: {
            ...conversationSet,
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
          kind: mailKind,
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
            action: auditAction,
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

/**
 * Both `addFeedbackMessage` and `remindFeedback` open by loading the target
 * conversation and treating a repeat submission of the same `clientMessageId`
 * as an already-applied retry: same lookup, same idempotent short-circuit.
 * What differs afterward — which statuses are still open, how long to wait —
 * is specific to each operation and stays inline in each caller.
 */
async function loadFeedbackConversationForReply(
  id: string,
  clientMessageId: string,
): Promise<
  | { kind: 'duplicate'; conversationId: string }
  | { kind: 'open'; conversation: InstanceType<typeof FeedbackConversation> }
> {
  const conversation = await FeedbackConversation.findById(requiredObjectId(id));
  if (!conversation)
    throw new CommunicationError('not_found', 'Feedback conversation not found', 404);
  const existing = await FeedbackMessage.findOne({
    conversationId: conversation._id,
    clientMessageId,
  });
  if (existing) return { kind: 'duplicate', conversationId: conversation.id };
  return { kind: 'open', conversation };
}

export async function addFeedbackMessage(
  id: string,
  actor: AdminActor,
  input: CreateFeedbackMessageInput,
): ReturnType<typeof getFeedback> {
  await connectDB();
  rejectPromotionalFeedback('', input.body);
  const loaded = await loadFeedbackConversationForReply(id, input.clientMessageId);
  if (loaded.kind === 'duplicate') return getFeedback(loaded.conversationId);
  const { conversation } = loaded;
  if (isClosedFeedbackStatus(conversation.status)) {
    throw new CommunicationError('conflict', 'Feedback conversation is not open', 409);
  }
  if (conversation.status === 'queued') {
    throw new CommunicationError('conflict', 'Wait until the invitation email is sent', 409);
  }
  const token = feedbackToken(conversation.id);
  const rendered = await renderFeedbackReply({
    body: input.body,
    preferencesUrl: feedbackPreferencesUrl(token),
  });
  return queueFeedbackReplyMail(
    conversation,
    actor,
    input.body,
    input.clientMessageId,
    rendered,
    'reply',
  );
}

export async function remindFeedback(
  id: string,
  actor: AdminActor,
  input: RemindFeedbackInput,
): ReturnType<typeof getFeedback> {
  await connectDB();
  const loaded = await loadFeedbackConversationForReply(id, input.clientMessageId);
  if (loaded.kind === 'duplicate') return getFeedback(loaded.conversationId);
  const { conversation } = loaded;
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
  const rendered = await renderFeedbackInvitation({
    body,
    preferencesUrl: feedbackPreferencesUrl(token),
    reminder: true,
  });
  return queueFeedbackReplyMail(
    conversation,
    actor,
    body,
    input.clientMessageId,
    rendered,
    'reminder',
  );
}

export async function completeFeedback(
  id: string,
  actor: AdminActor,
  revision: number,
): Promise<ReturnType<typeof feedbackConversationView>> {
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

export async function applyFeedbackPreference(
  token: string,
  action: 'decline' | 'opt_out',
): Promise<{ action: 'decline' | 'opt_out'; applied: boolean }> {
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
