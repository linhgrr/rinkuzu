import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const AUTH_SECRET = 'test-auth-secret-at-least-32-characters';
const REPLY_DOMAIN = 'feedback.rinkuzu.app';
const CONVERSATION_ID = '6a8ed209f04328ac17443d91';
const MESSAGE_ID = '6a8ed20a3d0a1892cacdfe0b';
const OUTBOX_ID = '6a8ed20a3d0a1892cacdfe0a';

const ENVIRONMENT: Record<string, string> = {
  AUTH_SECRET,
  FEEDBACK_REPLY_DOMAIN: REPLY_DOMAIN,
  FEEDBACK_MAIL_FROM: 'RinKuzu <hello@feedback.rinkuzu.app>',
  SUPPORT_MAIL_FROM: 'RinKuzu <hello@support.rinkuzu.app>',
  SUPPORT_ADMIN_EMAIL: 'admin@rinkuzu.app',
};

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  sendCommunicationEmail: vi.fn(),
  outbox: {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    deleteMany: vi.fn(),
  },
  conversation: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  message: { updateOne: vi.fn(), deleteMany: vi.fn() },
  campaign: { find: vi.fn(), updateMany: vi.fn(), updateOne: vi.fn(), countDocuments: vi.fn() },
  supportTicket: { find: vi.fn(), deleteMany: vi.fn() },
  supportAttachment: { find: vi.fn(), deleteMany: vi.fn(), deleteOne: vi.fn() },
  supportMessage: { deleteMany: vi.fn() },
  webhookEvent: { countDocuments: vi.fn() },
  preference: { updateOne: vi.fn() },
  nudge: { sweep: vi.fn(), prepare: vi.fn(), record: vi.fn() },
}));

/** Minimal thenable stand-in for a chained Mongoose query. */
function query<T>(result: T) {
  const chain = {
    sort: () => chain,
    select: () => chain,
    limit: () => chain,
    lean: () => chain,
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./resend', () => ({
  sendCommunicationEmail: mocks.sendCommunicationEmail,
  communicationEnvironment: (name: string) => {
    const value = ENVIRONMENT[name];
    if (!value) throw new Error(`${name} is required for communications`);
    return value;
  },
  addCampaignContact: vi.fn(),
  cancelBroadcast: vi.fn(),
  createBroadcastDraft: vi.fn(),
  createCampaignSegment: vi.fn(),
  getContactTopics: vi.fn(),
  getReceivingEmail: vi.fn(),
  marketingTopicId: vi.fn(),
  scheduleBroadcast: vi.fn(),
  syncMarketingContact: vi.fn(),
}));
vi.mock('./activation-nudge', () => ({
  sweepActivationNudges: mocks.nudge.sweep,
  prepareActivationNudge: mocks.nudge.prepare,
  recordActivationEmailSent: mocks.nudge.record,
}));
vi.mock('@/models/Communication', () => ({
  EmailOutbox: mocks.outbox,
  FeedbackConversation: mocks.conversation,
  FeedbackMessage: mocks.message,
  FeedbackOutreachPreference: mocks.preference,
  EmailCampaign: mocks.campaign,
  EmailCampaignAudience: { find: vi.fn(), updateOne: vi.fn(), aggregate: vi.fn() },
  EmailDeliveryEvent: { create: vi.fn(), aggregate: vi.fn() },
  SupportTicket: mocks.supportTicket,
  SupportMessage: mocks.supportMessage,
  SupportAttachment: mocks.supportAttachment,
  MarketingPreference: { findOne: vi.fn(), updateOne: vi.fn() },
  MarketingConsentEvent: { insertMany: vi.fn() },
  MarketingContactState: { findOne: vi.fn(), updateOne: vi.fn() },
  WebhookEvent: mocks.webhookEvent,
  AdminActionAudit: { create: vi.fn() },
}));

import { applyFeedbackPreference } from './feedback';
import { runCommunicationWorker } from './worker';
import { feedbackPreferenceToken, feedbackReplyToken } from './feedback-address';

const COMPACT_TOKEN = feedbackReplyToken(CONVERSATION_ID, AUTH_SECRET);
const COMPACT_REPLY_TO = `feedback+${COMPACT_TOKEN}@${REPLY_DOMAIN}`;
/** The address shape that made every production invitation fail: 77 octets. */
const LEGACY_REPLY_TO = `feedback+${feedbackPreferenceToken(CONVERSATION_ID, AUTH_SECRET)}@${REPLY_DOMAIN}`;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function outboxItem(overrides: Record<string, unknown> = {}) {
  return {
    _id: OUTBOX_ID,
    id: OUTBOX_ID,
    kind: 'feedback_invitation',
    entityType: 'feedback_conversation',
    entityId: { toString: () => CONVERSATION_ID },
    to: 'hantram3012@gmail.com',
    from: ENVIRONMENT['FEEDBACK_MAIL_FROM'],
    replyTo: LEGACY_REPLY_TO,
    subject: 'Bạn thấy trải nghiệm RinKuzu thế nào?',
    html: '<p>hi</p>',
    text: 'hi',
    inReplyTo: null,
    references: [],
    dedupeKey: `feedback/${CONVERSATION_ID}/message/${MESSAGE_ID}`,
    idempotencyKey: null,
    attempts: 5,
    ...overrides,
  };
}

/** Hands the worker exactly one outbox row, then drains. */
function queueOne(item: ReturnType<typeof outboxItem>) {
  mocks.outbox.findOneAndUpdate.mockResolvedValueOnce(item).mockResolvedValue(null);
}

function conversationDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CONVERSATION_ID,
    id: CONVERSATION_ID,
    status: 'queued',
    replyAddressTokenHash: digest(COMPACT_TOKEN),
    ...overrides,
  };
}

function outboxUpdateFor(predicate: (update: Record<string, never>) => boolean) {
  return mocks.outbox.updateOne.mock.calls.find((call) => predicate(call[1]));
}

describe('communication outbox delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.outbox.findOneAndUpdate.mockResolvedValue(null);
    mocks.outbox.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mocks.outbox.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.conversation.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mocks.conversation.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.conversation.find.mockReturnValue(query([]));
    mocks.message.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.campaign.find.mockReturnValue(query([]));
    mocks.campaign.updateMany.mockResolvedValue({ modifiedCount: 0 });
    mocks.supportTicket.find.mockReturnValue(query([]));
    mocks.supportAttachment.find.mockReturnValue(query([]));
    mocks.conversation.findById.mockReturnValue(query(conversationDoc()));
    mocks.nudge.sweep.mockResolvedValue({ enqueued: 0, skipped: 0 });
  });

  function nudgeItem() {
    return outboxItem({
      kind: 'activation_nudge',
      entityType: 'user',
      dedupeKey: `activation_nudge:${CONVERSATION_ID}`,
      replyTo: null,
      attempts: 1,
      trigger: '24h',
      locale: 'en',
    });
  }

  it('sweeps activation nudges each tick and survives a failed sweep (RIN-999)', async () => {
    mocks.nudge.sweep.mockResolvedValueOnce({ enqueued: 1, skipped: 2 });
    await expect(runCommunicationWorker(5)).resolves.toMatchObject({
      activationNudges: { enqueued: 1, skipped: 2 },
    });

    mocks.nudge.sweep.mockRejectedValueOnce(new Error('mongo down'));
    await expect(runCommunicationWorker(5)).resolves.toMatchObject({
      activationNudges: { enqueued: 0, skipped: 0 },
    });
  });

  it('sends a due activation nudge once and records activation_email_sent (RIN-999)', async () => {
    queueOne(nudgeItem());
    mocks.nudge.prepare.mockResolvedValue({
      decision: 'send',
      mail: {
        subject: 'Your 2-minute quiz is ready',
        html: '<p>x</p>',
        text: 'x',
        tags: [],
        headers: {},
      },
    });
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_nudge');

    const result = await runCommunicationWorker();

    expect(mocks.sendCommunicationEmail).toHaveBeenCalledOnce();
    expect(mocks.sendCommunicationEmail.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: `activation_nudge:${CONVERSATION_ID}`,
      subject: 'Your 2-minute quiz is ready',
    });
    expect(mocks.nudge.record).toHaveBeenCalledOnce();
    expect(result.outbox).toMatchObject({ completed: 1, canceled: 0 });
  });

  it('cancels a nudge whose learner activated after enqueue, without sending (RIN-999)', async () => {
    queueOne(nudgeItem());
    mocks.nudge.prepare.mockResolvedValue({ decision: 'cancel', reason: 'activated' });

    const result = await runCommunicationWorker();

    expect(mocks.sendCommunicationEmail).not.toHaveBeenCalled();
    expect(mocks.nudge.record).not.toHaveBeenCalled();
    const cancel = outboxUpdateFor((update) => update['$set']?.['status'] === 'canceled');
    expect(cancel?.[1]['$set']).toMatchObject({ status: 'canceled', lastError: 'activated' });
    expect(result.outbox).toMatchObject({ completed: 0, canceled: 1 });
  });

  it('holds activation nudges back while their kill switch is off (RIN-999)', async () => {
    vi.stubEnv('ACTIVATION_NUDGE_SENDING_ENABLED', 'false');
    try {
      await runCommunicationWorker(5);
      expect(mocks.outbox.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
        kind: { $nin: ['activation_nudge'] },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('claims review emails unless the kill switch is off, for both touches (RIN-915, RIN-1304)', async () => {
    await runCommunicationWorker(5);
    expect(mocks.outbox.findOneAndUpdate.mock.calls[0]?.[0]).not.toHaveProperty('kind');

    vi.stubEnv('REVIEW_REMINDER_SENDING_ENABLED', 'false');
    try {
      mocks.outbox.findOneAndUpdate.mockClear();
      await runCommunicationWorker(5);
      expect(mocks.outbox.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
        kind: { $nin: ['review_reminder', 'review_reminder_d5'] },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('repairs a legacy over-long Reply-To in place and sends exactly one email', async () => {
    queueOne(outboxItem());
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_1');

    const result = await runCommunicationWorker();

    const repair = outboxUpdateFor((update) => '$set' in update && 'replyTo' in update['$set']);
    expect(repair?.[1]['$set']).toMatchObject({
      replyTo: COMPACT_REPLY_TO,
      idempotencyKey: expect.stringContaining(`feedback/${CONVERSATION_ID}/message/${MESSAGE_ID}#`),
    });

    expect(mocks.sendCommunicationEmail).toHaveBeenCalledOnce();
    const sent = mocks.sendCommunicationEmail.mock.calls[0]?.[0];
    expect(sent.replyTo).toBe(COMPACT_REPLY_TO);
    expect(sent.replyTo.split('@')[0].length).toBeLessThanOrEqual(64);
    // The dedupe key is untouched, so no second outbox row can ever appear.
    expect(sent.idempotencyKey).toContain(`feedback/${CONVERSATION_ID}/message/${MESSAGE_ID}`);
    expect(result.outbox).toMatchObject({ completed: 1, retried: 0, dead: 0, canceled: 0 });
  });

  it('promotes the conversation to sent only after Resend returns an email id', async () => {
    queueOne(outboxItem());
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_1');

    await runCommunicationWorker();

    const completion = outboxUpdateFor((update) => update['$set']?.['status'] === 'completed');
    expect(completion?.[1]['$set']).toMatchObject({
      status: 'completed',
      externalEmailId: 're_email_1',
    });
    expect(mocks.message.updateOne).toHaveBeenCalledWith(
      { _id: MESSAGE_ID, conversationId: expect.anything(), direction: 'outbound' },
      { $set: { emailId: 're_email_1' } },
    );

    const promotion = mocks.conversation.updateOne.mock.calls.find(
      (call) => call[1]?.['$set']?.['status'] === 'sent',
    );
    expect(promotion?.[0]).toMatchObject({ status: 'queued' });
    const { sentAt, expiresAt } = promotion?.[1]['$set'] as { sentAt: Date; expiresAt: Date };
    expect(expiresAt.getTime() - sentAt.getTime()).toBe(30 * 86_400_000);
  });

  it('promotes the conversation before closing the outbox row', async () => {
    queueOne(outboxItem());
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_1');
    const order: string[] = [];
    mocks.conversation.updateOne.mockImplementation(async (_filter, update) => {
      if (update?.['$set']?.['status'] === 'sent') order.push('conversation:sent');
      return { matchedCount: 1, modifiedCount: 1 };
    });
    mocks.outbox.updateOne.mockImplementation(async (_filter, update) => {
      if (update?.['$set']?.['status'] === 'completed') order.push('outbox:completed');
      return { matchedCount: 1, modifiedCount: 1 };
    });

    await runCommunicationWorker();

    // Only a pending/processing row is ever re-claimed, so closing the row
    // first would make an interruption between the two writes permanent.
    expect(order).toEqual(['conversation:sent', 'outbox:completed']);
  });

  it('keeps the conversation queued while retries are still available', async () => {
    queueOne(outboxItem({ attempts: 5 }));
    mocks.sendCommunicationEmail.mockRejectedValue(
      new Error('Resend email failed: [validation_error] Invalid `reply_to` field.'),
    );

    const result = await runCommunicationWorker();

    expect(result.outbox).toMatchObject({ completed: 0, retried: 1, dead: 0 });
    expect(outboxUpdateFor((update) => update['$set']?.['status'] === 'pending')).toBeDefined();
    expect(
      mocks.conversation.updateOne.mock.calls.filter((call) =>
        ['sent', 'failed'].includes(String(call[1]?.['$set']?.['status'])),
      ),
    ).toHaveLength(0);
  });

  it('fails the conversation once the twelfth attempt is exhausted', async () => {
    queueOne(outboxItem({ attempts: 12 }));
    mocks.sendCommunicationEmail.mockRejectedValue(new Error('Resend email failed: [api] down'));

    const result = await runCommunicationWorker();

    expect(result.outbox).toMatchObject({ dead: 1, retried: 0 });
    expect(outboxUpdateFor((update) => update['$set']?.['status'] === 'dead')).toBeDefined();
    const failure = mocks.conversation.updateOne.mock.calls.find(
      (call) => call[1]?.['$set']?.['status'] === 'failed',
    );
    expect(failure?.[0]['status']).toEqual({
      $in: ['queued', 'sent', 'replied', 'in_conversation'],
    });
  });

  it('resets a legacy fake `sent` status before retrying the invitation', async () => {
    const fakeSentAt = new Date('2026-08-26T09:00:00.000Z');
    queueOne(outboxItem());
    mocks.conversation.findById.mockReturnValue(
      query(conversationDoc({ status: 'sent', queuedAt: null, sentAt: fakeSentAt })),
    );
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_1');

    await runCommunicationWorker();

    const demotion = mocks.conversation.updateOne.mock.calls.find(
      (call) => call[1]?.['$set']?.['status'] === 'queued',
    );
    expect(demotion?.[0]).toMatchObject({ status: 'sent' });
    expect(demotion?.[1]['$set']).toMatchObject({ queuedAt: fakeSentAt, sentAt: null });

    // The invitation then goes through the normal promotion path, so `sentAt`
    // ends up describing the moment Resend accepted it.
    const promotion = mocks.conversation.updateOne.mock.calls.find(
      (call) => call[1]?.['$set']?.['status'] === 'sent',
    );
    expect(promotion?.[0]).toMatchObject({ status: 'queued' });
    const { sentAt } = promotion?.[1]['$set'] as { sentAt: Date };
    expect(sentAt.getTime()).toBeGreaterThan(fakeSentAt.getTime());
  });

  it('leaves a reminder alone when the conversation is legitimately sent', async () => {
    queueOne(outboxItem({ kind: 'feedback_reminder', replyTo: COMPACT_REPLY_TO }));
    mocks.conversation.findById.mockReturnValue(query(conversationDoc({ status: 'sent' })));
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_4');

    await runCommunicationWorker();

    expect(mocks.conversation.updateOne).not.toHaveBeenCalled();
    expect(mocks.sendCommunicationEmail).toHaveBeenCalledOnce();
  });

  it('yields without sending when another worker steals the lease mid-repair', async () => {
    queueOne(outboxItem());
    mocks.outbox.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    const result = await runCommunicationWorker();

    expect(mocks.sendCommunicationEmail).not.toHaveBeenCalled();
    expect(result.outbox).toMatchObject({ completed: 0, retried: 0, dead: 0, canceled: 0 });
  });

  it('cancels instead of sending when the user already opted out', async () => {
    queueOne(outboxItem());
    mocks.conversation.findById.mockReturnValue(query(conversationDoc({ status: 'opted_out' })));

    const result = await runCommunicationWorker();

    expect(mocks.sendCommunicationEmail).not.toHaveBeenCalled();
    expect(result.outbox).toMatchObject({ canceled: 1, completed: 0, retried: 0, dead: 0 });
    expect(outboxUpdateFor((update) => update['$set']?.['status'] === 'canceled')?.[1]).toEqual({
      $set: { status: 'canceled', lastError: 'conversation_opted_out' },
      $unset: { leaseToken: '', leaseUntil: '' },
    });
  });

  it('cancels a queued invitation whose conversation disappeared', async () => {
    queueOne(outboxItem());
    mocks.conversation.findById.mockReturnValue(query(null));

    await runCommunicationWorker();

    expect(mocks.sendCommunicationEmail).not.toHaveBeenCalled();
    expect(
      outboxUpdateFor((update) => update['$set']?.['lastError'] === 'conversation_missing'),
    ).toBeDefined();
  });

  it('leaves an already correct Reply-To untouched and reuses the dedupe key', async () => {
    queueOne(outboxItem({ replyTo: COMPACT_REPLY_TO, attempts: 1 }));
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_2');

    await runCommunicationWorker();

    expect(outboxUpdateFor((update) => 'replyTo' in (update['$set'] ?? {}))).toBeUndefined();
    expect(mocks.sendCommunicationEmail.mock.calls[0]?.[0].idempotencyKey).toBe(
      `feedback/${CONVERSATION_ID}/message/${MESSAGE_ID}`,
    );
  });

  it('redacts recipient addresses and token-shaped strings from the stored error', async () => {
    queueOne(outboxItem());
    mocks.sendCommunicationEmail.mockRejectedValue(
      new Error(`Invalid reply_to hantram3012@gmail.com token ${COMPACT_TOKEN}`),
    );

    await runCommunicationWorker();

    const failure = outboxUpdateFor((update) => update['$set']?.['status'] === 'pending');
    const lastError = String(failure?.[1]['$set']['lastError']);
    expect(lastError).not.toContain('hantram3012');
    expect(lastError).not.toContain(COMPACT_TOKEN);
    expect(lastError).toContain('[email]');
  });

  it('does not run the feedback guard for support notifications', async () => {
    queueOne(
      outboxItem({
        kind: 'support_notification',
        entityType: 'support_ticket',
        replyTo: null,
        dedupeKey: `support/${CONVERSATION_ID}/message/${MESSAGE_ID}`,
      }),
    );
    mocks.sendCommunicationEmail.mockResolvedValue('re_email_3');

    await runCommunicationWorker();

    expect(mocks.conversation.findById).not.toHaveBeenCalled();
    expect(mocks.sendCommunicationEmail).toHaveBeenCalledOnce();
  });
});

describe('feedback opt-out stops queued mail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.preference.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.conversation.updateMany.mockResolvedValue({ modifiedCount: 1 });
    mocks.outbox.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it('cancels pending outbox rows for every conversation it closes', async () => {
    const token = feedbackPreferenceToken(CONVERSATION_ID, AUTH_SECRET);
    mocks.conversation.findOne.mockResolvedValue({
      _id: CONVERSATION_ID,
      userId: 'user-1',
      status: 'queued',
    });
    mocks.conversation.find.mockReturnValue(query([{ _id: CONVERSATION_ID }]));

    await applyFeedbackPreference(token, 'opt_out');

    expect(mocks.conversation.findOne).toHaveBeenCalledWith({ replyTokenHash: digest(token) });
    expect(mocks.conversation.find.mock.calls[0]?.[0]['status']).toEqual({
      $in: ['draft', 'queued', 'sent', 'replied', 'in_conversation'],
    });
    expect(mocks.outbox.updateMany).toHaveBeenCalledWith(
      {
        entityType: 'feedback_conversation',
        entityId: { $in: [CONVERSATION_ID] },
        status: 'pending',
      },
      { $set: { status: 'canceled', lastError: 'conversation_closed' } },
    );
  });

  it('repeats the status predicate on the write so a completed conversation is not reopened', async () => {
    const token = feedbackPreferenceToken(CONVERSATION_ID, AUTH_SECRET);
    mocks.conversation.findOne.mockResolvedValue({
      _id: CONVERSATION_ID,
      userId: 'user-1',
      status: 'queued',
    });
    mocks.conversation.find.mockReturnValue(query([{ _id: CONVERSATION_ID }]));

    await applyFeedbackPreference(token, 'opt_out');

    // The ids come from a separate read; without the predicate a conversation
    // completed in between would be rewritten to opted_out.
    expect(mocks.conversation.updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [CONVERSATION_ID] },
        status: { $in: ['draft', 'queued', 'sent', 'replied', 'in_conversation'] },
      },
      expect.objectContaining({ $set: { status: 'opted_out', declinedAt: expect.any(Date) } }),
    );
  });
});

describe('feedback reply token derivation', () => {
  it('derives the reply-address hash the inbound lookup uses', () => {
    expect(digest(COMPACT_TOKEN)).toBe(
      createHash('sha256')
        .update(
          createHmac('sha256', AUTH_SECRET)
            .update(`feedback-reply:${CONVERSATION_ID}`)
            .digest('base64url'),
        )
        .digest('hex'),
    );
  });
});
