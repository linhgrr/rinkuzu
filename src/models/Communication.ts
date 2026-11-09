import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

const SUPPORT_STATUSES = [
  'open',
  'waiting_for_admin',
  'waiting_for_user',
  'resolved',
  'closed',
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

const FEEDBACK_STATUSES = [
  'draft',
  'queued',
  'sent',
  'replied',
  'in_conversation',
  'declined',
  'opted_out',
  'completed',
  'expired',
  'failed',
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const MARKETING_TOPICS = ['product_updates', 'promotions'] as const;
export type MarketingTopic = (typeof MARKETING_TOPICS)[number];

/**
 * Every topic a consent event can record. `study_reminders` (RIN-915) is a
 * one-to-one reminder, not a campaign topic, so campaigns keep to
 * `MARKETING_TOPICS` and never target it.
 */
const CONSENT_TOPICS = [...MARKETING_TOPICS, 'study_reminders'] as const;
type ConsentTopic = (typeof CONSENT_TOPICS)[number];

const CONSENT_SOURCES = [
  'settings',
  'prompt',
  'unsubscribe',
  'admin_suppression',
  'result_page_review',
] as const;
type ConsentSource = (typeof CONSENT_SOURCES)[number];

const OUTBOX_KINDS = [
  'support_notification',
  'feedback_invitation',
  'feedback_reply',
  'feedback_reminder',
  'review_reminder',
  /** Final day-5 review touch (RIN-1304); its own kind so d2 rows stay as they are. */
  'review_reminder_d5',
  /** One per account for its lifetime, 24 h after signup (RIN-999). */
  'activation_nudge',
  /** One per rejected Premium submission, to its author (RIN-1348). */
  'premium_decision',
] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

const OUTBOX_ENTITY_TYPES = [
  'support_ticket',
  'feedback_conversation',
  'attempt',
  'user',
  'premium_submission',
] as const;
export type OutboxEntityType = (typeof OUTBOX_ENTITY_TYPES)[number];

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
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

interface SupportTicketDocument extends Document {
  userId: Types.ObjectId;
  subject: string;
  category: 'general' | 'account' | 'billing' | 'technical' | 'feedback';
  status: SupportStatus;
  priority: 'normal' | 'high';
  createdBy: 'user' | 'admin';
  assignedAdminId?: Types.ObjectId | null;
  lastMessageAt: Date;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenUntil?: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SupportMessageDocument extends Document {
  ticketId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  authorRole: 'user' | 'admin';
  body: string;
  attachmentIds: Types.ObjectId[];
  clientMessageId: string;
  createdAt: Date;
}

interface SupportAttachmentDocument extends Document {
  ticketId?: Types.ObjectId | null;
  messageId?: Types.ObjectId | null;
  ownerUserId: Types.ObjectId;
  storageKey: string;
  status: 'pending' | 'ready';
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  size: number;
  width?: number | null;
  height?: number | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

interface FeedbackOutreachPreferenceDocument extends Document {
  userId: Types.ObjectId;
  optedOutAt?: Date | null;
  reason?: 'user_opt_out' | 'admin_suppression' | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedbackConversationDocument extends Document {
  userId: Types.ObjectId;
  userEmail: string;
  subject: string;
  status: FeedbackStatus;
  replyTokenHash: string;
  replyAddressTokenHash?: string | null;
  createdBy: Types.ObjectId;
  queuedAt?: Date | null;
  sentAt?: Date | null;
  repliedAt?: Date | null;
  remindedAt?: Date | null;
  completedAt?: Date | null;
  declinedAt?: Date | null;
  expiresAt: Date;
  lastMessageAt: Date;
  lastMessageIdHeader?: string | null;
  references: string[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedbackMessageDocument extends Document {
  conversationId: Types.ObjectId;
  direction: 'outbound' | 'inbound' | 'system';
  source: 'admin_app' | 'email_inbound' | 'system';
  body: string;
  emailId?: string | null;
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  hasAttachments: boolean;
  clientMessageId: string;
  createdAt: Date;
}

interface MarketingPreferenceDocument extends Document {
  userId: Types.ObjectId;
  productUpdates: boolean;
  promotions: boolean;
  /** Opt-in to the 2-day review email (RIN-915). */
  studyReminders: boolean;
  studyRemindersOptedInAt?: Date | null;
  locale?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MarketingConsentEventDocument extends Document {
  userId: Types.ObjectId;
  topic: ConsentTopic;
  action: 'opt_in' | 'opt_out';
  source: ConsentSource;
  ipHash?: string | null;
  /** Email of an unsubscribe-link opt-out; absent means the w1-review email (RIN-1044). */
  campaign?: string;
  createdAt: Date;
}

interface MarketingContactStateDocument extends Document {
  userId: Types.ObjectId;
  email: string;
  status: 'deliverable' | 'hard_bounced' | 'complained' | 'suppressed';
  resendContactId?: string | null;
  lastEventAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CampaignBlockDocument {
  type: 'heading' | 'paragraph' | 'image' | 'button' | 'divider' | 'spacer';
  text?: string;
  level?: number;
  url?: string;
  label?: string;
  height?: number;
}

interface EmailCampaignDocument extends Document {
  name: string;
  subject: string;
  previewText?: string | null;
  topic: MarketingTopic;
  status: CampaignStatus;
  blocks: CampaignBlockDocument[];
  locale?: string | null;
  planId?: string | null;
  recipientCount: number;
  contentHash: string;
  testedContentHash?: string | null;
  testedAt?: Date | null;
  scheduledAt?: Date | null;
  sendingStartedAt?: Date | null;
  sentAt?: Date | null;
  stoppedAt?: Date | null;
  stopReason?: string | null;
  resendSegmentId?: string | null;
  resendBroadcastId?: string | null;
  createdBy: Types.ObjectId;
  revision: number;
  metrics: {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface EmailCampaignAudienceDocument extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  status: 'prepared' | 'processing' | 'synced' | 'sent' | 'suppressed' | 'failed';
  attempts: number;
  availableAt: Date;
  leaseUntil?: Date | null;
  leaseToken?: string | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface EmailDeliveryEventDocument extends Document {
  externalEventId: string;
  campaignId?: Types.ObjectId | null;
  eventType: string;
  emailId?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

interface EmailOutboxDocument extends Document {
  kind: OutboxKind;
  entityType: OutboxEntityType;
  entityId: Types.ObjectId;
  /** Recipient user, set on per-learner reminders so caps survive an email change. */
  userId?: Types.ObjectId | null;
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string | null;
  references: string[];
  dedupeKey: string;
  idempotencyKey?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'dead' | 'canceled';
  attempts: number;
  availableAt: Date;
  leaseUntil?: Date | null;
  leaseToken?: string | null;
  lastError?: string | null;
  externalEmailId?: string | null;
  /** First `email.opened` of a `campaign=w1-review` email (RIN-916); set once. */
  openedAt?: Date | null;
  /** Activation nudge (RIN-999): what enqueued it and the locale it renders in. */
  trigger?: '24h' | 'backfill' | null;
  locale?: string | null;
  /** First tracked CTA click of an activation nudge (RIN-1000); set once. */
  clickedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WebhookEventDocument extends Document {
  externalId: string;
  eventType: string;
  emailId?: string | null;
  payloadDigest: string;
  status: 'processing' | 'processed' | 'quarantined' | 'failed';
  attempts: number;
  leaseUntil?: Date | null;
  quarantineReason?: string | null;
  processedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

interface AdminActionAuditDocument extends Document {
  actorId: Types.ObjectId;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Map<string, string>;
  createdAt: Date;
  expiresAt: Date;
}

const SupportTicketSchema = new Schema<SupportTicketDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    category: {
      type: String,
      enum: ['general', 'account', 'billing', 'technical', 'feedback'],
      required: true,
    },
    status: { type: String, enum: SUPPORT_STATUSES, required: true, default: 'open' },
    priority: { type: String, enum: ['normal', 'high'], required: true, default: 'normal' },
    createdBy: { type: String, enum: ['user', 'admin'], required: true },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenUntil: { type: Date, default: null },
    revision: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);
SupportTicketSchema.index({ userId: 1, lastMessageAt: -1 });
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });

const SupportMessageSchema = new Schema<SupportMessageDocument>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['user', 'admin'], required: true },
    body: { type: String, required: true, maxlength: 20_000 },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'SupportAttachment' }],
    clientMessageId: { type: String, required: true, maxlength: 128 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
SupportMessageSchema.index({ ticketId: 1, clientMessageId: 1 }, { unique: true });

const SupportAttachmentSchema = new Schema<SupportAttachmentDocument>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', default: null },
    messageId: { type: Schema.Types.ObjectId, ref: 'SupportMessage', default: null },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storageKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'ready'], required: true, default: 'pending' },
    contentType: { type: String, enum: ['image/png', 'image/jpeg', 'image/webp'], required: true },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
SupportAttachmentSchema.index({ expiresAt: 1 });

const FeedbackOutreachPreferenceSchema = new Schema<FeedbackOutreachPreferenceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    optedOutAt: { type: Date, default: null },
    reason: { type: String, enum: ['user_opt_out', 'admin_suppression', null], default: null },
  },
  { timestamps: true, versionKey: false },
);

const FeedbackConversationSchema = new Schema<FeedbackConversationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userEmail: { type: String, required: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: FEEDBACK_STATUSES, required: true, default: 'draft' },
    replyTokenHash: { type: String, required: true, unique: true },
    replyAddressTokenHash: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    queuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    remindedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    lastMessageAt: { type: Date, required: true, default: Date.now },
    lastMessageIdHeader: { type: String, default: null },
    references: { type: [String], required: true, default: [] },
    revision: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);
FeedbackConversationSchema.index(
  { replyAddressTokenHash: 1 },
  { unique: true, partialFilterExpression: { replyAddressTokenHash: { $type: 'string' } } },
);
FeedbackConversationSchema.index({ userId: 1, createdAt: -1 });
FeedbackConversationSchema.index({ userId: 1, sentAt: -1 });
FeedbackConversationSchema.index({ sentAt: -1 });
FeedbackConversationSchema.index({ status: 1, lastMessageAt: -1 });
FeedbackConversationSchema.index({ status: 1, expiresAt: 1 });

const FeedbackMessageSchema = new Schema<FeedbackMessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'FeedbackConversation', required: true },
    direction: { type: String, enum: ['outbound', 'inbound', 'system'], required: true },
    source: { type: String, enum: ['admin_app', 'email_inbound', 'system'], required: true },
    body: { type: String, required: true, maxlength: 20_000 },
    emailId: { type: String, default: null },
    messageIdHeader: { type: String, default: null },
    inReplyTo: { type: String, default: null },
    hasAttachments: { type: Boolean, required: true, default: false },
    clientMessageId: { type: String, required: true, maxlength: 128 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
FeedbackMessageSchema.index({ conversationId: 1, createdAt: 1 });
FeedbackMessageSchema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });
FeedbackMessageSchema.index(
  { emailId: 1 },
  { unique: true, partialFilterExpression: { emailId: { $type: 'string' } } },
);

const MarketingPreferenceSchema = new Schema<MarketingPreferenceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    productUpdates: { type: Boolean, required: true, default: false },
    promotions: { type: Boolean, required: true, default: false },
    studyReminders: { type: Boolean, required: true, default: false },
    studyRemindersOptedInAt: { type: Date, default: null },
    locale: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

const MarketingConsentEventSchema = new Schema<MarketingConsentEventDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    topic: { type: String, enum: CONSENT_TOPICS, required: true },
    action: { type: String, enum: ['opt_in', 'opt_out'], required: true },
    source: { type: String, enum: CONSENT_SOURCES, required: true },
    ipHash: { type: String, default: null },
    campaign: { type: String, maxlength: 32 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
MarketingConsentEventSchema.index({ userId: 1, topic: 1, createdAt: -1 });
MarketingConsentEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 5 * 365 * 24 * 60 * 60 });

const MarketingContactStateSchema = new Schema<MarketingContactStateDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: { type: String, required: true, lowercase: true },
    status: {
      type: String,
      enum: ['deliverable', 'hard_bounced', 'complained', 'suppressed'],
      required: true,
      default: 'deliverable',
    },
    resendContactId: { type: String, default: null },
    lastEventAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
MarketingContactStateSchema.index({ email: 1 });

const CampaignBlockSchema = new Schema<CampaignBlockDocument>(
  {
    type: {
      type: String,
      enum: ['heading', 'paragraph', 'image', 'button', 'divider', 'spacer'],
      required: true,
    },
    text: { type: String, maxlength: 10_000 },
    level: { type: Number, min: 1, max: 3 },
    url: { type: String, maxlength: 2_048 },
    label: { type: String, maxlength: 160 },
    height: { type: Number, min: 4, max: 120 },
  },
  { _id: false },
);

const EmailCampaignSchema = new Schema<EmailCampaignDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    previewText: { type: String, default: null, maxlength: 200 },
    topic: { type: String, enum: MARKETING_TOPICS, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, required: true, default: 'draft' },
    blocks: {
      type: [CampaignBlockSchema],
      required: true,
      validate: [(v: unknown[]) => v.length <= 50, 'Too many blocks'],
    },
    locale: { type: String, default: null },
    planId: { type: String, default: null },
    recipientCount: { type: Number, required: true, default: 0, min: 0 },
    contentHash: { type: String, required: true },
    testedContentHash: { type: String, default: null },
    testedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    sendingStartedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
    stopReason: { type: String, default: null, maxlength: 500 },
    resendSegmentId: { type: String, default: null },
    resendBroadcastId: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revision: { type: Number, required: true, default: 0, min: 0 },
    metrics: {
      sent: { type: Number, required: true, default: 0 },
      delivered: { type: Number, required: true, default: 0 },
      bounced: { type: Number, required: true, default: 0 },
      complained: { type: Number, required: true, default: 0 },
      opened: { type: Number, required: true, default: 0 },
      clicked: { type: Number, required: true, default: 0 },
      unsubscribed: { type: Number, required: true, default: 0 },
    },
  },
  { timestamps: true, versionKey: false },
);
EmailCampaignSchema.index({ status: 1, scheduledAt: 1 });
EmailCampaignSchema.index({ createdAt: -1 });
EmailCampaignSchema.index({ resendBroadcastId: 1 }, { sparse: true });

function leaseQueueFields(lastErrorMaxLength: number) {
  return {
    attempts: { type: Number, required: true, default: 0, min: 0 },
    availableAt: { type: Date, required: true, default: Date.now },
    leaseUntil: { type: Date, default: null },
    leaseToken: { type: String, default: null },
    lastError: { type: String, default: null, maxlength: lastErrorMaxLength },
  } as const;
}

const EmailCampaignAudienceSchema = new Schema<EmailCampaignAudienceDocument>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true },
    status: {
      type: String,
      enum: ['prepared', 'processing', 'synced', 'sent', 'suppressed', 'failed'],
      required: true,
      default: 'prepared',
    },
    ...leaseQueueFields(1_000),
  },
  { timestamps: true, versionKey: false },
);
EmailCampaignAudienceSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
EmailCampaignAudienceSchema.index({ campaignId: 1, status: 1, availableAt: 1, leaseUntil: 1 });

const EmailDeliveryEventSchema = new Schema<EmailDeliveryEventDocument>(
  {
    externalEventId: { type: String, required: true, unique: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', default: null },
    eventType: { type: String, required: true },
    emailId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
EmailDeliveryEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
EmailDeliveryEventSchema.index(
  { emailId: 1, eventType: 1 },
  {
    unique: true,
    partialFilterExpression: { emailId: { $type: 'string' } },
  },
);

const EmailOutboxSchema = new Schema<EmailOutboxDocument>(
  {
    kind: { type: String, enum: OUTBOX_KINDS, required: true },
    entityType: { type: String, enum: OUTBOX_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    to: { type: String, required: true, lowercase: true },
    from: { type: String, required: true },
    replyTo: { type: String, default: null },
    subject: { type: String, required: true, maxlength: 200 },
    html: { type: String, required: true, maxlength: 500_000 },
    text: { type: String, required: true, maxlength: 100_000 },
    inReplyTo: { type: String, default: null },
    references: { type: [String], required: true, default: [] },
    dedupeKey: { type: String, required: true, unique: true, maxlength: 256 },
    idempotencyKey: { type: String, default: null, maxlength: 256 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'dead', 'canceled'],
      required: true,
      default: 'pending',
    },
    ...leaseQueueFields(2_000),
    externalEmailId: { type: String, default: null },
    openedAt: { type: Date, default: null },
    trigger: { type: String, enum: ['24h', 'backfill', null], default: null },
    locale: { type: String, default: null, maxlength: 8 },
    clickedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
EmailOutboxSchema.index({ status: 1, availableAt: 1, leaseUntil: 1 });
EmailOutboxSchema.index({ externalEmailId: 1 }, { sparse: true });
// Review-reminder caps and cancellations (RIN-915): per learner, newest first.
// Partial, so the support/feedback rows (no userId) never enter it.
EmailOutboxSchema.index(
  { userId: 1, kind: 1, updatedAt: -1 },
  { partialFilterExpression: { userId: { $type: 'objectId' } } },
);

const WebhookEventSchema = new Schema<WebhookEventDocument>(
  {
    externalId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    emailId: { type: String, default: null },
    payloadDigest: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'processed', 'quarantined', 'failed'],
      required: true,
      default: 'processing',
    },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    leaseUntil: { type: Date, default: null },
    quarantineReason: { type: String, default: null, maxlength: 1_000 },
    processedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
WebhookEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
WebhookEventSchema.index({ status: 1, leaseUntil: 1 });

const AdminActionAuditSchema = new Schema<AdminActionAuditDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorEmail: { type: String, required: true, lowercase: true },
    action: { type: String, required: true, maxlength: 120 },
    entityType: { type: String, required: true, maxlength: 80 },
    entityId: { type: String, required: true, maxlength: 128 },
    details: { type: Map, of: String, required: true, default: {} },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
AdminActionAuditSchema.index({ actorId: 1, createdAt: -1 });
AdminActionAuditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AdminActionAuditSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

function existingOrCreate<T extends Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const SupportTicket = existingOrCreate('SupportTicket', SupportTicketSchema);
export const SupportMessage = existingOrCreate('SupportMessage', SupportMessageSchema);
export const SupportAttachment = existingOrCreate('SupportAttachment', SupportAttachmentSchema);
export const FeedbackOutreachPreference = existingOrCreate(
  'FeedbackOutreachPreference',
  FeedbackOutreachPreferenceSchema,
);
export const FeedbackConversation = existingOrCreate(
  'FeedbackConversation',
  FeedbackConversationSchema,
);
export const FeedbackMessage = existingOrCreate('FeedbackMessage', FeedbackMessageSchema);
export const MarketingPreference = existingOrCreate(
  'MarketingPreference',
  MarketingPreferenceSchema,
);
export const MarketingConsentEvent = existingOrCreate(
  'MarketingConsentEvent',
  MarketingConsentEventSchema,
);
export const MarketingContactState = existingOrCreate(
  'MarketingContactState',
  MarketingContactStateSchema,
);
export const EmailCampaign = existingOrCreate('EmailCampaign', EmailCampaignSchema);
export const EmailCampaignAudience = existingOrCreate(
  'EmailCampaignAudience',
  EmailCampaignAudienceSchema,
);
export const EmailDeliveryEvent = existingOrCreate('EmailDeliveryEvent', EmailDeliveryEventSchema);
export const EmailOutbox = existingOrCreate('EmailOutbox', EmailOutboxSchema);
export const WebhookEvent = existingOrCreate('WebhookEvent', WebhookEventSchema);
export const AdminActionAudit = existingOrCreate('AdminActionAudit', AdminActionAuditSchema);
