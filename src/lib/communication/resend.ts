import 'server-only';

import { Resend, type WebhookEventPayload } from 'resend';

let client: Resend | null = null;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for communications`);
  return value;
}

function communicationResend(): Resend {
  client ??= new Resend(requiredEnvironment('RESEND_API_KEY'));
  return client;
}

export interface OutboundCommunicationEmail {
  to: string;
  from: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
  idempotencyKey: string;
  entityType: string;
  entityId: string;
}

export async function sendCommunicationEmail(input: OutboundCommunicationEmail): Promise<string> {
  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers['In-Reply-To'] = input.inReplyTo;
  if (input.references?.length) headers['References'] = input.references.join(' ');

  const { data, error } = await communicationResend().emails.send(
    {
      to: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
      tags: [
        { name: 'entity_type', value: input.entityType.slice(0, 256) },
        { name: 'entity_id', value: input.entityId.slice(0, 256) },
      ],
    },
    { idempotencyKey: input.idempotencyKey.slice(0, 256) },
  );
  if (error) throw new Error(`Resend email failed: [${error.name}] ${error.message}`);
  if (!data?.id) throw new Error('Resend email returned no id');
  return data.id;
}

export async function createCampaignSegment(name: string): Promise<string> {
  const { data, error } = await communicationResend().segments.create({ name });
  if (error) throw new Error(`Resend segment failed: [${error.name}] ${error.message}`);
  if (!data?.id) throw new Error('Resend segment returned no id');
  return data.id;
}

export async function addCampaignContact(input: {
  email: string;
  segmentId: string;
  topicId: string;
}): Promise<string> {
  const resend = communicationResend();
  const existing = await resend.contacts.get({ email: input.email });
  let contactId = existing.data?.id;

  if (contactId) {
    const { error: topicError } = await resend.contacts.topics.update({
      id: contactId,
      topics: [{ id: input.topicId, subscription: 'opt_in' }],
    });
    if (topicError) {
      throw new Error(`Resend topic sync failed: [${topicError.name}] ${topicError.message}`);
    }
  } else {
    const { data, error } = await resend.contacts.create({
      email: input.email,
      unsubscribed: false,
      topics: [{ id: input.topicId, subscription: 'opt_in' }],
    });
    if (error) throw new Error(`Resend contact failed: [${error.name}] ${error.message}`);
    if (!data?.id) throw new Error('Resend contact returned no id');
    contactId = data.id;
  }

  const segments = await resend.contacts.segments.list({ contactId });
  if (segments.error) {
    throw new Error(
      `Resend segment lookup failed: [${segments.error.name}] ${segments.error.message}`,
    );
  }
  if (!segments.data?.data.some((segment) => segment.id === input.segmentId)) {
    const { error } = await resend.contacts.segments.add({ contactId, segmentId: input.segmentId });
    if (error) throw new Error(`Resend segment member failed: [${error.name}] ${error.message}`);
  }
  return contactId;
}

export async function syncMarketingContact(input: {
  email: string;
  productUpdates: boolean;
  promotions: boolean;
}): Promise<string> {
  const productTopic = requiredEnvironment('RESEND_PRODUCT_UPDATES_TOPIC_ID');
  const promotionTopic = requiredEnvironment('RESEND_PROMOTIONS_TOPIC_ID');
  const topics = [
    {
      id: productTopic,
      subscription: input.productUpdates ? ('opt_in' as const) : ('opt_out' as const),
    },
    {
      id: promotionTopic,
      subscription: input.promotions ? ('opt_in' as const) : ('opt_out' as const),
    },
  ];
  const existing = await communicationResend().contacts.get({ email: input.email });
  if (existing.data?.id) {
    const { error } = await communicationResend().contacts.topics.update({
      id: existing.data.id,
      topics,
    });
    if (error) throw new Error(`Resend topic sync failed: [${error.name}] ${error.message}`);
    return existing.data.id;
  }
  const { data, error } = await communicationResend().contacts.create({
    email: input.email,
    unsubscribed: false,
    topics,
  });
  if (error) throw new Error(`Resend contact sync failed: [${error.name}] ${error.message}`);
  if (!data?.id) throw new Error('Resend contact sync returned no id');
  return data.id;
}

export async function getContactTopics(email: string) {
  const { data, error } = await communicationResend().contacts.topics.list({ email });
  if (error) throw new Error(`Resend topic lookup failed: [${error.name}] ${error.message}`);
  return data?.data ?? [];
}

export function marketingTopicId(topic: 'product_updates' | 'promotions'): string {
  return requiredEnvironment(
    topic === 'product_updates' ? 'RESEND_PRODUCT_UPDATES_TOPIC_ID' : 'RESEND_PROMOTIONS_TOPIC_ID',
  );
}

export async function createBroadcastDraft(input: {
  name: string;
  subject: string;
  previewText?: string | null;
  html: string;
  text: string;
  segmentId: string;
  topicId: string;
}): Promise<string> {
  const { data, error } = await communicationResend().broadcasts.create({
    name: input.name,
    subject: input.subject,
    ...(input.previewText ? { previewText: input.previewText } : {}),
    from: requiredEnvironment('MARKETING_MAIL_FROM'),
    html: input.html,
    text: input.text,
    segmentId: input.segmentId,
    topicId: input.topicId,
    send: false,
  });
  if (error) throw new Error(`Resend broadcast draft failed: [${error.name}] ${error.message}`);
  if (!data?.id) throw new Error('Resend broadcast draft returned no id');
  return data.id;
}

export async function scheduleBroadcast(id: string, scheduledAt: Date): Promise<void> {
  const { data, error } = await communicationResend().broadcasts.send(id, {
    scheduledAt: scheduledAt.toISOString(),
  });
  if (error) throw new Error(`Resend broadcast schedule failed: [${error.name}] ${error.message}`);
  if (!data?.id) throw new Error('Resend broadcast schedule returned no id');
}

export async function cancelBroadcast(id: string): Promise<void> {
  const { error } = await communicationResend().broadcasts.remove(id);
  if (error) throw new Error(`Resend broadcast cancel failed: [${error.name}] ${error.message}`);
}

export async function getReceivingEmail(id: string) {
  const { data, error } = await communicationResend().emails.receiving.get(id);
  if (error) throw new Error(`Resend receiving failed: [${error.name}] ${error.message}`);
  if (!data) throw new Error('Resend receiving returned no data');
  return data;
}

export function verifyResendWebhook(input: {
  payload: string;
  id: string;
  timestamp: string;
  signature: string;
}): WebhookEventPayload {
  return communicationResend().webhooks.verify({
    payload: input.payload,
    headers: { id: input.id, timestamp: input.timestamp, signature: input.signature },
    webhookSecret: requiredEnvironment('RESEND_WEBHOOK_SECRET'),
  });
}

export function communicationEnvironment(name: string): string {
  return requiredEnvironment(name);
}
