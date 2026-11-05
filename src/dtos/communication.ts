import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const clientMessageId = z.string().trim().min(8).max(128);
const messageBody = z.string().trim().min(1).max(20_000);

export const communicationIdParamsSchema = z.strictObject({ id: mongoId });
export const supportTicketParamsSchema = z.strictObject({ ticketId: mongoId });

export const supportListQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z
    .enum(['all', 'open', 'waiting_for_admin', 'waiting_for_user', 'resolved', 'closed'])
    .default('all'),
});

export const createSupportTicketSchema = z.strictObject({
  subject: z.string().trim().min(4).max(160),
  category: z.enum(['general', 'account', 'billing', 'technical', 'feedback']),
  body: messageBody,
  attachmentIds: z.array(mongoId).max(3).default([]),
  clientMessageId,
  userId: mongoId.optional(),
});

export const createSupportMessageSchema = z.strictObject({
  body: messageBody,
  attachmentIds: z.array(mongoId).max(3).default([]),
  clientMessageId,
});

export const updateSupportTicketSchema = z.strictObject({
  status: z.enum(['open', 'waiting_for_admin', 'waiting_for_user', 'resolved', 'closed']),
  priority: z.enum(['normal', 'high']).optional(),
  revision: z.number().int().min(0),
});

export const createSupportAttachmentSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

function pagedStatusQuery<const T extends readonly [string, ...string[]]>(statuses: T) {
  return z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(statuses).default('all'),
  });
}

export const feedbackListQuerySchema = pagedStatusQuery([
  'all',
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
]).extend({ userId: mongoId.optional() });

export const createFeedbackConversationSchema = z.strictObject({
  userId: mongoId,
  subject: z.string().trim().min(4).max(160),
  body: messageBody,
  clientMessageId,
});

export const createFeedbackMessageSchema = z.strictObject({
  body: messageBody,
  clientMessageId,
});

export const remindFeedbackSchema = z.strictObject({
  body: messageBody.optional(),
  clientMessageId,
});

export const completeFeedbackSchema = z.strictObject({
  revision: z.number().int().min(0),
});

export const feedbackPreferenceSchema = z.strictObject({
  token: z.string().trim().min(32).max(512),
  action: z.enum(['decline', 'opt_out']),
});

export const marketingPreferenceSchema = z.strictObject({
  productUpdates: z.boolean(),
  promotions: z.boolean(),
  locale: z.string().trim().min(2).max(16).optional(),
  source: z.enum(['settings', 'prompt']).default('settings'),
});

/** Result-page review-email tick (RIN-915). `optIn: false` un-ticks it. */
export const reviewReminderRequestSchema = z.strictObject({
  attemptId: z.string().regex(/^[a-f0-9]{24}$/u, 'Invalid attempt id'),
  optIn: z.boolean().default(true),
  locale: z.enum(['vi', 'en']).default('vi'),
});

const headingBlockSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal('heading'),
  text: z.string().trim().min(1).max(300),
  level: z.number().int().min(1).max(3).default(2),
});
const paragraphBlockSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal('paragraph'),
  text: z.string().trim().min(1).max(10_000),
});
const imageBlockSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal('image'),
  url: z.url().refine((value) => value.startsWith('https:'), 'Image URL must use HTTPS'),
  label: z.string().trim().min(1).max(160),
});
const buttonBlockSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal('button'),
  label: z.string().trim().min(1).max(160),
  url: z.url().refine((value) => value.startsWith('https:'), 'Button URL must use HTTPS'),
});
const dividerBlockSchema = z.strictObject({ id: z.uuid(), type: z.literal('divider') });
const spacerBlockSchema = z.strictObject({
  id: z.uuid(),
  type: z.literal('spacer'),
  height: z.number().int().min(4).max(120).default(24),
});

export const campaignBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  paragraphBlockSchema,
  imageBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
]);

export const campaignListQuerySchema = pagedStatusQuery([
  'all',
  'draft',
  'preparing_audience',
  'ready',
  'scheduled',
  'sending',
  'sent',
  'partially_failed',
  'failed',
  'cancelled',
]);

export const createCampaignSchema = z.strictObject({
  name: z.string().trim().min(3).max(160),
  subject: z.string().trim().min(3).max(160),
  previewText: z.string().trim().max(200).optional(),
  topic: z.enum(['product_updates', 'promotions']),
  blocks: z.array(campaignBlockSchema).min(1).max(50),
  locale: z.string().trim().min(2).max(16).optional(),
  planId: z.string().trim().min(1).max(128).optional(),
});

export const updateCampaignSchema = createCampaignSchema.extend({
  revision: z.number().int().min(0),
});

export const testCampaignSchema = z.strictObject({
  revision: z.number().int().min(0),
});

export const prepareCampaignSchema = z.strictObject({
  revision: z.number().int().min(0),
});

export const scheduleCampaignSchema = z.strictObject({
  revision: z.number().int().min(0),
  scheduledAt: z.iso.datetime(),
  confirmation: z.string().trim().min(1).max(80),
});

export const cancelCampaignSchema = z.strictObject({
  revision: z.number().int().min(0),
  reason: z.string().trim().min(3).max(500).default('Cancelled by administrator'),
});

export type CampaignBlockInput = z.infer<typeof campaignBlockSchema>;
