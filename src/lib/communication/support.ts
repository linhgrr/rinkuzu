import 'server-only';

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mongoose, { Types, type ClientSession } from 'mongoose';
import sharp from 'sharp';
import type { z } from 'zod';

import type {
  createSupportAttachmentSchema,
  createSupportMessageSchema,
  createSupportTicketSchema,
  supportListQuerySchema,
  updateSupportTicketSchema,
} from '@/dtos/communication';
import connectDB from '@/lib/mongoose';
import { BUCKET_NAME, s3Client } from '@/lib/s3';
import {
  AdminActionAudit,
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  type SupportStatus,
} from '@/models/Communication';
import User from '@/models/User';
import { ACCOUNT_DISABLE_ACTIVE } from '@/shared/constants/account-disable';
import { communicationEnvironment } from './resend';
import { renderSupportNotification, type RenderedCommunicationMail } from './templates';
import {
  audit,
  auditExpiry,
  CommunicationError,
  DAY,
  pageMeta,
  queueMail,
  requiredObjectId,
  siteUrl,
  type AdminActor,
  type PageResult,
} from './internal';

type SupportListQuery = z.infer<typeof supportListQuerySchema>;
type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
type CreateSupportMessageInput = z.infer<typeof createSupportMessageSchema>;
type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>;
type CreateSupportAttachmentInput = z.infer<typeof createSupportAttachmentSchema>;

const SUPPORT_UPLOAD_ROOT = 'uploads/support_pending';
const SUPPORT_READY_ROOT = 'support/attachments';

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

async function userEmailMap(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: ids } }).select('_id email');
  return new Map(users.map((user) => [user.id, user.email]));
}

/**
 * Queues the "you have a new support reply" notification email shared by
 * `createSupportTicket` and `addSupportMessage`. Both call sites render the
 * same notification shape and differ only in the ticket, recipient, subject
 * source and rendered content, so those are the only parameters.
 */
async function queueSupportNotification(
  ticketId: Types.ObjectId,
  to: string,
  subject: string,
  rendered: RenderedCommunicationMail,
  messageId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  await queueMail(
    {
      kind: 'support_notification',
      entityType: 'support_ticket',
      entityId: ticketId,
      to,
      from: communicationEnvironment('SUPPORT_MAIL_FROM'),
      subject,
      ...rendered,
      dedupeKey: `support/${ticketId.toString()}/message/${messageId.toString()}`,
    },
    session,
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

export async function getSupportTicket(
  ticketId: string,
  userId: string,
  admin: boolean,
): Promise<{
  ticket: ReturnType<typeof supportTicketView>;
  messages: {
    id: string;
    authorUserId: string;
    authorRole: InstanceType<typeof SupportMessage>['authorRole'];
    body: string;
    attachments: {
      id: string;
      contentType: string;
      size: number;
      width: number | null;
      height: number | null;
      url: string;
    }[];
    createdAt: string;
  }[];
}> {
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
): Promise<{
  attachmentId: string;
  uploadUrl: string;
  uploadMethod: 'PUT';
  uploadHeaders: { 'Content-Type': CreateSupportAttachmentInput['contentType'] };
  expiresAt: string;
}> {
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

/**
 * Claims a batch of finalized attachments onto the ticket/message they now
 * belong to. Shared by `createSupportTicket` and `addSupportMessage`, which
 * differ only in which ticket id the attachments are being claimed onto.
 */
async function claimSupportAttachments(
  attachments: Types.ObjectId[],
  actorId: string,
  ticketId: Types.ObjectId,
  messageId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  if (!attachments.length) return;
  const claimed = await SupportAttachment.updateMany(
    {
      _id: { $in: attachments },
      ownerUserId: requiredObjectId(actorId, 'actor id'),
      status: 'ready',
      ticketId: null,
      messageId: null,
    },
    { $set: { ticketId, messageId, expiresAt: null } },
    { session },
  );
  if (claimed.modifiedCount !== attachments.length) {
    throw new CommunicationError('conflict', 'One or more attachments were already used', 409);
  }
}

export async function createSupportTicket(
  actorId: string,
  actorEmail: string,
  input: CreateSupportTicketInput,
  admin: boolean,
): ReturnType<typeof getSupportTicket> {
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
      await claimSupportAttachments(attachments, actorId, ticketId, messageId, dbSession);
      if (admin && notification) {
        await queueSupportNotification(
          ticketId,
          target.email,
          `RinKuzu Support: ${input.subject}`,
          notification,
          messageId,
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
): ReturnType<typeof getSupportTicket> {
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
      await claimSupportAttachments(attachments, actorId, ticket._id, messageId, dbSession);
      if (recipient && rendered) {
        await queueSupportNotification(
          ticket._id,
          recipient,
          `RinKuzu Support: ${ticket.subject}`,
          rendered,
          messageId,
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
): Promise<ReturnType<typeof supportTicketView>> {
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

export async function reopenSupportTicket(
  ticketId: string,
  userId: string,
): Promise<ReturnType<typeof supportTicketView>> {
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
