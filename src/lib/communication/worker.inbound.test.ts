import { createHash } from 'node:crypto';
import type { WebhookEventPayload } from 'resend';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const AUTH_SECRET = 'test-auth-secret-at-least-32-characters';
const REPLY_DOMAIN = 'feedback.rinkuzu.app';
const CONVERSATION_ID = '6a8ed209f04328ac17443d91';
const USER_EMAIL = 'learner@example.com';

const ENVIRONMENT: Record<string, string> = {
  AUTH_SECRET,
  FEEDBACK_REPLY_DOMAIN: REPLY_DOMAIN,
  FEEDBACK_MAIL_FROM: 'RinKuzu <hello@feedback.rinkuzu.app>',
};

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  getReceivingEmail: vi.fn(),
  webhook: { findOne: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
  conversation: { findOne: vi.fn(), updateOne: vi.fn() },
  message: { findOneAndUpdate: vi.fn() },
  outbox: { findOne: vi.fn(), updateOne: vi.fn() },
  user: { findOne: vi.fn() },
  contactState: { updateOne: vi.fn() },
}));

function selectable<T>(result: T) {
  return { select: () => Promise.resolve(result) };
}

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./resend', () => ({
  getReceivingEmail: mocks.getReceivingEmail,
  communicationEnvironment: (name: string) => {
    const value = ENVIRONMENT[name];
    if (!value) throw new Error(`${name} is required for communications`);
    return value;
  },
  sendCommunicationEmail: vi.fn(),
  addCampaignContact: vi.fn(),
  cancelBroadcast: vi.fn(),
  createBroadcastDraft: vi.fn(),
  createCampaignSegment: vi.fn(),
  getContactTopics: vi.fn(),
  marketingTopicId: vi.fn(),
  scheduleBroadcast: vi.fn(),
  syncMarketingContact: vi.fn(),
}));
vi.mock('@/models/User', () => ({ default: mocks.user }));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: mocks.outbox,
  FeedbackConversation: mocks.conversation,
  FeedbackMessage: mocks.message,
  FeedbackOutreachPreference: { updateOne: vi.fn() },
  EmailCampaign: { findOne: vi.fn(), findById: vi.fn(), updateOne: vi.fn() },
  EmailCampaignAudience: { find: vi.fn(), aggregate: vi.fn() },
  EmailDeliveryEvent: { create: vi.fn(), aggregate: vi.fn() },
  SupportTicket: { find: vi.fn() },
  SupportMessage: { deleteMany: vi.fn() },
  SupportAttachment: { find: vi.fn() },
  MarketingPreference: { findOne: vi.fn(), updateOne: vi.fn() },
  MarketingConsentEvent: { insertMany: vi.fn() },
  MarketingContactState: mocks.contactState,
  WebhookEvent: mocks.webhook,
  AdminActionAudit: { create: vi.fn() },
}));

import { processResendWebhook } from './worker';
import { feedbackPreferenceToken, feedbackReplyToken } from './feedback-address';

const REPLY_TOKEN = feedbackReplyToken(CONVERSATION_ID, AUTH_SECRET);
const REPLY_ADDRESS = `feedback+${REPLY_TOKEN}@${REPLY_DOMAIN}`;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const CREATED_AT = '2026-08-26T10:00:00.000Z';

function receivedEvent(
  to: string[] = [REPLY_ADDRESS],
  from = USER_EMAIL,
): Extract<WebhookEventPayload, { type: 'email.received' }> {
  return {
    type: 'email.received',
    created_at: CREATED_AT,
    data: {
      email_id: 'inbound-1',
      created_at: CREATED_AT,
      from,
      to,
      bcc: [],
      cc: [],
      message_id: '<inbound@mail>',
      subject: 'Re: Bạn thấy trải nghiệm RinKuzu thế nào?',
      attachments: [],
    },
  };
}

function bouncedEvent(): Extract<WebhookEventPayload, { type: 'email.bounced' }> {
  return {
    type: 'email.bounced',
    created_at: CREATED_AT,
    data: {
      email_id: 're_email_1',
      created_at: CREATED_AT,
      from: ENVIRONMENT['FEEDBACK_MAIL_FROM'] ?? '',
      to: [USER_EMAIL],
      subject: 'Bạn thấy trải nghiệm RinKuzu thế nào?',
      bounce: { message: 'mailbox unavailable', subType: 'General', type: 'Permanent' },
    },
  };
}

function conversationDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CONVERSATION_ID,
    id: CONVERSATION_ID,
    userId: 'user-1',
    status: 'sent',
    repliedAt: null,
    references: [],
    revision: 1,
    lastMessageAt: new Date(),
    lastMessageIdHeader: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('inbound feedback routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.webhook.findOne.mockResolvedValue(null);
    mocks.webhook.create.mockResolvedValue({ status: 'processing', payloadDigest: 'digest' });
    mocks.webhook.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.user.findOne.mockReturnValue(selectable({ _id: 'user-1', email: USER_EMAIL }));
    mocks.getReceivingEmail.mockResolvedValue({
      to: [REPLY_ADDRESS],
      from: USER_EMAIL,
      text: 'Trải nghiệm rất tốt.',
      html: null,
      message_id: '<inbound@mail>',
      headers: {},
      attachments: [],
    });
    mocks.message.findOneAndUpdate.mockResolvedValue({ createdAt: new Date() });
  });

  it('looks the conversation up by the reply-address hash, not the preference hash', async () => {
    mocks.conversation.findOne.mockResolvedValue(conversationDoc());

    const result = await processResendWebhook('evt-1', 'digest', receivedEvent());

    expect(mocks.conversation.findOne).toHaveBeenCalledWith({
      replyAddressTokenHash: digest(REPLY_TOKEN),
    });
    expect(result).toMatchObject({ status: 'processed' });
  });

  it('quarantines a preference token presented as a reply address', async () => {
    const forged = `feedback+${feedbackPreferenceToken(CONVERSATION_ID, AUTH_SECRET)}@${REPLY_DOMAIN}`;

    const result = await processResendWebhook('evt-2', 'digest', receivedEvent([forged]));

    expect(mocks.conversation.findOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'quarantined', reason: 'unknown_reply_destination' });
  });

  it('quarantines a forged token that matches no conversation', async () => {
    mocks.conversation.findOne.mockResolvedValue(null);
    const forged = `feedback+${'A'.repeat(43)}@${REPLY_DOMAIN}`;

    const result = await processResendWebhook('evt-3', 'digest', receivedEvent([forged]));

    expect(result).toMatchObject({ status: 'quarantined', reason: 'unknown_reply_token' });
  });

  it('quarantines a reply sent from someone other than the invited user', async () => {
    mocks.conversation.findOne.mockResolvedValue(conversationDoc());

    const result = await processResendWebhook(
      'evt-4',
      'digest',
      receivedEvent([REPLY_ADDRESS], 'attacker@example.com'),
    );

    expect(result).toMatchObject({ status: 'quarantined', reason: 'sender_mismatch' });
    expect(mocks.getReceivingEmail).not.toHaveBeenCalled();
  });

  it('quarantines a reply to a conversation the user already opted out of', async () => {
    mocks.conversation.findOne.mockResolvedValue(conversationDoc({ status: 'opted_out' }));

    const result = await processResendWebhook('evt-5', 'digest', receivedEvent());

    expect(result).toMatchObject({ status: 'quarantined', reason: 'conversation_closed' });
  });

  it('replays a duplicate webhook without touching the conversation again', async () => {
    mocks.webhook.findOne.mockResolvedValue({ status: 'processed', payloadDigest: 'digest' });

    const result = await processResendWebhook('evt-1', 'digest', receivedEvent());

    expect(result).toEqual({ status: 'processed', duplicate: true });
    expect(mocks.conversation.findOne).not.toHaveBeenCalled();
    expect(mocks.message.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a replayed webhook id carrying a different payload', async () => {
    mocks.webhook.findOne.mockResolvedValue({ status: 'processed', payloadDigest: 'other' });

    await expect(processResendWebhook('evt-1', 'digest', receivedEvent())).rejects.toThrow(
      'Webhook id was reused',
    );
  });
});

describe('out-of-order delivery events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.webhook.findOne.mockResolvedValue(null);
    mocks.webhook.create.mockResolvedValue({ status: 'processing', payloadDigest: 'digest' });
    mocks.webhook.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.user.findOne.mockReturnValue(selectable(null));
    mocks.conversation.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('fails a conversation whose bounce arrives before the send was recorded', async () => {
    mocks.outbox.findOne.mockResolvedValue({
      entityType: 'feedback_conversation',
      entityId: CONVERSATION_ID,
    });

    await processResendWebhook('evt-bounce', 'digest', bouncedEvent());

    expect(mocks.conversation.updateOne).toHaveBeenCalledWith(
      { _id: CONVERSATION_ID, status: { $in: ['queued', 'sent', 'in_conversation'] } },
      { $set: { status: 'failed' }, $inc: { revision: 1 } },
    );
  });

  it('records the provider email id so a stored webhook is traceable', async () => {
    mocks.outbox.findOne.mockResolvedValue(null);

    await processResendWebhook('evt-traceable', 'digest', bouncedEvent());

    const completion = mocks.webhook.updateOne.mock.calls.find(
      (call) => call[1]?.['$set']?.['status'] === 'processed',
    );
    expect(completion?.[1]['$set']).toMatchObject({ emailId: 're_email_1' });
  });
});

function openedEvent(
  tags: Record<string, string> | null = { campaign: 'w1-review' },
): Extract<WebhookEventPayload, { type: 'email.opened' }> {
  return {
    type: 'email.opened',
    created_at: CREATED_AT,
    data: {
      email_id: 're_review_1',
      created_at: CREATED_AT,
      from: 'RinKuzu <support@rinkuzu.app>',
      to: [USER_EMAIL],
      subject: 'Review',
      ...(tags ? { tags } : {}),
    },
  };
}

describe('review email opens (RIN-916)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.webhook.findOne.mockResolvedValue(null);
    mocks.webhook.create.mockResolvedValue({ status: 'processing', payloadDigest: 'digest' });
    mocks.webhook.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.outbox.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it('marks the first open of a w1-review email once, keeping updatedAt', async () => {
    await processResendWebhook('evt-open-1', 'digest', openedEvent());

    expect(mocks.outbox.updateOne).toHaveBeenCalledTimes(1);
    expect(mocks.outbox.updateOne).toHaveBeenCalledWith(
      { externalEmailId: 're_review_1', kind: 'review_reminder', openedAt: null },
      { $set: { openedAt: expect.any(Date) } },
      { timestamps: false },
    );
  });

  it('does not count a replayed open webhook again', async () => {
    mocks.webhook.findOne.mockResolvedValue({ status: 'processed', payloadDigest: 'digest' });

    const result = await processResendWebhook('evt-open-1', 'digest', openedEvent());

    expect(result).toEqual({ status: 'processed', duplicate: true });
    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });

  it('ignores opens of QA sends and untagged mail', async () => {
    await processResendWebhook('evt-open-qa', 'digest', openedEvent({ campaign: 'w1-review-qa' }));
    await processResendWebhook('evt-open-none', 'digest', openedEvent(null));

    expect(mocks.outbox.updateOne).not.toHaveBeenCalled();
  });
});
