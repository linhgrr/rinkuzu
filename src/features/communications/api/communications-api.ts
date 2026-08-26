import { fetchApiData } from '@/lib/api/client';
import type {
  CampaignBlockViewModel,
  CampaignDetailViewModel,
  CampaignViewModel,
  FeedbackConversationViewModel,
  FeedbackDetailViewModel,
  MarketingPreferenceViewModel,
  PageViewModel,
  SupportDetailViewModel,
  SupportTicketViewModel,
} from '../types/communication-view-model';

interface CreateSupportTicketRequest {
  subject: string;
  category: string;
  body: string;
  attachmentIds: string[];
  clientMessageId: string;
  userId?: string;
}

interface CreateFeedbackInvitationRequest {
  userId: string;
  subject: string;
  body: string;
}

interface FeedbackPreferenceResult {
  applied: boolean;
}

interface SaveMarketingPreferencesRequest {
  productUpdates: boolean;
  promotions: boolean;
  locale?: string;
  source: 'settings' | 'prompt';
}

interface CreateCampaignRequest {
  name: string;
  subject: string;
  previewText?: string;
  topic: 'product_updates' | 'promotions';
  blocks: CampaignBlockViewModel[];
  locale?: string;
  planId?: string;
}

interface UpdateCampaignRequest extends CreateCampaignRequest {
  revision: number;
}

function jsonMutation<T>(url: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown): Promise<T> {
  return fetchApiData<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchSupportTickets(
  admin = false,
  page = 1,
): Promise<PageViewModel<SupportTicketViewModel>> {
  return fetchApiData(
    `${admin ? '/api/admin/support' : '/api/support/tickets'}?page=${page}&limit=20&status=all`,
  );
}

export function fetchSupportDetail(id: string, admin = false): Promise<SupportDetailViewModel> {
  return fetchApiData(admin ? `/api/admin/support/${id}` : `/api/support/tickets/${id}`);
}

export function createSupportTicket(
  input: CreateSupportTicketRequest,
  admin = false,
): Promise<SupportDetailViewModel> {
  return jsonMutation(admin ? '/api/admin/support' : '/api/support/tickets', 'POST', input);
}

export function addSupportMessage(
  id: string,
  body: string,
  attachmentIds: string[],
  admin = false,
): Promise<SupportDetailViewModel> {
  return jsonMutation(
    admin ? `/api/admin/support/${id}/messages` : `/api/support/tickets/${id}/messages`,
    'POST',
    { body, attachmentIds, clientMessageId: crypto.randomUUID() },
  );
}

export function updateSupportStatus(
  id: string,
  status: string,
  revision: number,
  priority?: string,
): Promise<SupportTicketViewModel> {
  return jsonMutation(`/api/admin/support/${id}`, 'PATCH', {
    status,
    revision,
    ...(priority ? { priority } : {}),
  });
}

export function reopenSupport(id: string): Promise<SupportTicketViewModel> {
  return jsonMutation(`/api/support/tickets/${id}/reopen`, 'POST', {});
}

export async function uploadSupportImage(file: File): Promise<string> {
  const intent = await jsonMutation<{
    attachmentId: string;
    uploadUrl: string;
    uploadMethod: 'PUT';
    uploadHeaders: Record<string, string>;
  }>('/api/support/attachments/presign', 'POST', {
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });
  const response = await fetch(intent.uploadUrl, {
    method: intent.uploadMethod,
    headers: intent.uploadHeaders,
    body: file,
  });
  if (!response.ok) throw new Error('Không thể tải ảnh hỗ trợ lên');
  return intent.attachmentId;
}

export function fetchFeedbackList(
  userId?: string,
  page = 1,
): Promise<PageViewModel<FeedbackConversationViewModel>> {
  const query = new URLSearchParams({ page: String(page), limit: '20', status: 'all' });
  if (userId) query.set('userId', userId);
  return fetchApiData(`/api/admin/feedback?${query.toString()}`);
}

export function fetchFeedbackDetail(id: string): Promise<FeedbackDetailViewModel> {
  return fetchApiData(`/api/admin/feedback/${id}`);
}

export function createFeedbackInvitation(
  input: CreateFeedbackInvitationRequest,
): Promise<FeedbackDetailViewModel> {
  return jsonMutation('/api/admin/feedback', 'POST', {
    ...input,
    clientMessageId: crypto.randomUUID(),
  });
}

export function replyFeedback(id: string, body: string): Promise<FeedbackDetailViewModel> {
  return jsonMutation(`/api/admin/feedback/${id}/messages`, 'POST', {
    body,
    clientMessageId: crypto.randomUUID(),
  });
}

export function remindFeedback(id: string): Promise<FeedbackDetailViewModel> {
  return jsonMutation(`/api/admin/feedback/${id}/remind`, 'POST', {
    clientMessageId: crypto.randomUUID(),
  });
}

export function completeFeedback(
  id: string,
  revision: number,
): Promise<FeedbackConversationViewModel> {
  return jsonMutation(`/api/admin/feedback/${id}/complete`, 'POST', { revision });
}

export function applyFeedbackPreference(
  token: string,
  action: 'decline' | 'opt_out',
): Promise<FeedbackPreferenceResult> {
  return jsonMutation('/api/feedback/preferences', 'POST', { token, action });
}

export function fetchMarketingPreferences(): Promise<MarketingPreferenceViewModel> {
  return fetchApiData('/api/user/marketing-preferences');
}

export function saveMarketingPreferences(
  input: SaveMarketingPreferencesRequest,
): Promise<MarketingPreferenceViewModel> {
  return jsonMutation('/api/user/marketing-preferences', 'PUT', input);
}

export function fetchCampaigns(page = 1): Promise<PageViewModel<CampaignViewModel>> {
  return fetchApiData(`/api/admin/campaigns?page=${page}&limit=20&status=all`);
}

export function fetchCampaignDetail(id: string): Promise<CampaignDetailViewModel> {
  return fetchApiData(`/api/admin/campaigns/${id}`);
}

export function createCampaign(input: CreateCampaignRequest): Promise<CampaignDetailViewModel> {
  return jsonMutation('/api/admin/campaigns', 'POST', input);
}

export function updateCampaign(
  id: string,
  input: UpdateCampaignRequest,
): Promise<CampaignDetailViewModel> {
  return jsonMutation(`/api/admin/campaigns/${id}`, 'PATCH', input);
}

export function testCampaign(id: string, revision: number): Promise<CampaignDetailViewModel> {
  return jsonMutation(`/api/admin/campaigns/${id}/test`, 'POST', { revision });
}

export function prepareCampaign(id: string, revision: number): Promise<CampaignDetailViewModel> {
  return jsonMutation(`/api/admin/campaigns/${id}/prepare`, 'POST', { revision });
}

export function scheduleCampaign(
  id: string,
  revision: number,
  scheduledAt: string,
  confirmation: string,
): Promise<CampaignDetailViewModel> {
  return jsonMutation(`/api/admin/campaigns/${id}/schedule`, 'POST', {
    revision,
    scheduledAt,
    confirmation,
  });
}

export function cancelCampaign(id: string, revision: number): Promise<CampaignDetailViewModel> {
  return jsonMutation(`/api/admin/campaigns/${id}/cancel`, 'POST', {
    revision,
    reason: 'Stopped by administrator',
  });
}
