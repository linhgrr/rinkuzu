type SupportStatus = 'open' | 'waiting_for_admin' | 'waiting_for_user' | 'resolved' | 'closed';

export interface SupportTicketViewModel {
  id: string;
  userId: string;
  userEmail?: string;
  subject: string;
  category: string;
  status: SupportStatus;
  priority: 'normal' | 'high';
  createdBy: 'user' | 'admin';
  lastMessageAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenUntil: string | null;
  canReopen: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface SupportMessageViewModel {
  id: string;
  authorUserId: string;
  authorRole: 'user' | 'admin';
  body: string;
  attachments: Array<{
    id: string;
    contentType: string;
    size: number;
    width: number | null;
    height: number | null;
    url: string;
  }>;
  createdAt: string;
}

export interface SupportDetailViewModel {
  ticket: SupportTicketViewModel;
  messages: SupportMessageViewModel[];
}

export interface FeedbackConversationViewModel {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  status: string;
  sentAt: string | null;
  repliedAt: string | null;
  remindedAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  expiresAt: string;
  lastMessageAt: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackDetailViewModel {
  conversation: FeedbackConversationViewModel;
  messages: Array<{
    id: string;
    direction: 'outbound' | 'inbound' | 'system';
    source: string;
    body: string;
    hasAttachments: boolean;
    emailId: string | null;
    createdAt: string;
  }>;
}

export type CampaignBlockViewModel = { id: string } & (
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; label: string }
  | { type: 'button'; url: string; label: string }
  | { type: 'divider' }
  | { type: 'spacer'; height: number }
);

export interface CampaignViewModel {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  topic: 'product_updates' | 'promotions';
  status: string;
  blocks: CampaignBlockViewModel[];
  locale: string | null;
  planId: string | null;
  recipientCount: number;
  contentHash: string;
  testedContentHash: string | null;
  testedAt: string | null;
  scheduledAt: string | null;
  sendingStartedAt: string | null;
  sentAt: string | null;
  stoppedAt: string | null;
  stopReason: string | null;
  metrics: {
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  };
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetailViewModel {
  campaign: CampaignViewModel;
  audience: Record<string, number>;
}

export interface PageViewModel<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface MarketingPreferenceViewModel {
  productUpdates: boolean;
  promotions: boolean;
  locale: string | null;
  updatedAt: string | null;
}
