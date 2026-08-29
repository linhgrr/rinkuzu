import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENVIRONMENT: Record<string, string> = {
  AUTH_SECRET: 'test-auth-secret-at-least-32-characters',
  FEEDBACK_REPLY_DOMAIN: 'feedback.rinkuzu.app',
  FEEDBACK_MAIL_FROM: 'RinKuzu <hello@feedback.rinkuzu.app>',
};

const CONVERSATION_ID = '6a8ed209f04328ac17443d91';
const USER_ID = '6a8ed209f04328ac17443d92';
const ACTOR = { id: '6a8ed209f04328ac17443d93', email: 'admin@rinkuzu.app' };
const DAY = 86_400_000;

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  conversation: { findById: vi.fn(), exists: vi.fn(), countDocuments: vi.fn() },
  message: { findOne: vi.fn() },
  user: { findOne: vi.fn() },
  preference: { findOne: vi.fn() },
  contactState: { findOne: vi.fn() },
}));

function selectable<T>(result: T) {
  return { select: () => Promise.resolve(result) };
}

vi.mock('@/lib/mongoose', () => ({ default: mocks.connectDB }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./resend', () => ({
  communicationEnvironment: (name: string) => {
    const value = ENVIRONMENT[name];
    if (!value) throw new Error(`${name} is required for communications`);
    return value;
  },
  sendCommunicationEmail: vi.fn(),
  getReceivingEmail: vi.fn(),
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
  EmailOutbox: { updateOne: vi.fn(), updateMany: vi.fn() },
  FeedbackConversation: mocks.conversation,
  FeedbackMessage: mocks.message,
  FeedbackOutreachPreference: mocks.preference,
  EmailCampaign: { findOne: vi.fn() },
  EmailCampaignAudience: { find: vi.fn() },
  EmailDeliveryEvent: { create: vi.fn() },
  SupportTicket: { find: vi.fn() },
  SupportMessage: { deleteMany: vi.fn() },
  SupportAttachment: { find: vi.fn() },
  MarketingPreference: { findOne: vi.fn() },
  MarketingConsentEvent: { insertMany: vi.fn() },
  MarketingContactState: mocks.contactState,
  WebhookEvent: { findOne: vi.fn() },
  AdminActionAudit: { create: vi.fn() },
}));

import { addFeedbackMessage, createFeedback, remindFeedback } from './feedback';

function conversationDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: CONVERSATION_ID,
    id: CONVERSATION_ID,
    userId: USER_ID,
    userEmail: 'user@example.com',
    subject: 'Bạn thấy trải nghiệm RinKuzu thế nào?',
    status: 'queued',
    sentAt: null,
    remindedAt: null,
    revision: 0,
    references: [],
    lastMessageIdHeader: null,
    ...overrides,
  };
}

describe('admin outreach is gated on a real send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.message.findOne.mockResolvedValue(null);
  });

  it('refuses an admin reply while the invitation is still queued', async () => {
    mocks.conversation.findById.mockResolvedValue(conversationDoc());

    await expect(
      addFeedbackMessage(CONVERSATION_ID, ACTOR, {
        body: 'Cảm ơn bạn đã phản hồi.',
        clientMessageId: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    ).rejects.toThrow('Wait until the invitation email is sent');
  });

  it('refuses a reminder while the invitation is still queued', async () => {
    mocks.conversation.findById.mockResolvedValue(conversationDoc());

    await expect(
      remindFeedback(CONVERSATION_ID, ACTOR, {
        clientMessageId: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    ).rejects.toThrow('Only unanswered invitations can be reminded');
  });

  it('refuses a reminder before the invitation has been sent for seven days', async () => {
    mocks.conversation.findById.mockResolvedValue(
      conversationDoc({ status: 'sent', sentAt: new Date(Date.now() - 6 * DAY) }),
    );

    await expect(
      remindFeedback(CONVERSATION_ID, ACTOR, {
        clientMessageId: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
      }),
    ).rejects.toThrow('Wait at least 7 days before reminding');
  });
});

describe('frequency caps count queued invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.user.findOne.mockReturnValue(selectable({ _id: USER_ID, email: 'user@example.com' }));
    mocks.preference.findOne.mockResolvedValue(null);
    mocks.contactState.findOne.mockResolvedValue(null);
    mocks.conversation.exists.mockResolvedValue(null);
    mocks.conversation.countDocuments.mockResolvedValue(0);
  });

  const input = {
    userId: USER_ID,
    subject: 'Bạn thấy trải nghiệm RinKuzu thế nào?',
    body: 'Mình muốn lắng nghe trải nghiệm của bạn.',
    clientMessageId: '0aa7c561-a366-4abf-81ec-fb90e64c237c',
  };

  it('uses creation time so a queued invitation still blocks a second one', async () => {
    mocks.conversation.exists.mockResolvedValue({ _id: CONVERSATION_ID });

    await expect(createFeedback(ACTOR, input)).rejects.toThrow('invited in the last 90 days');

    const filter = mocks.conversation.exists.mock.calls[0]?.[0];
    expect(filter).toMatchObject({ status: { $nin: ['draft', 'failed'] } });
    expect(filter).toHaveProperty('createdAt');
    expect(filter).not.toHaveProperty('sentAt');
  });

  it('counts queued invitations against the daily cap', async () => {
    mocks.conversation.countDocuments.mockResolvedValue(20);

    await expect(createFeedback(ACTOR, input)).rejects.toThrow('Daily feedback invitation limit');

    const filter = mocks.conversation.countDocuments.mock.calls[0]?.[0];
    expect(filter).toMatchObject({ status: { $nin: ['draft', 'failed'] } });
    expect(filter).not.toHaveProperty('sentAt');
  });
});
