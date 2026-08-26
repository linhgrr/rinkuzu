import type { FeedbackStatusViewModel } from '../types/communication-view-model';

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatCommunicationTimestamp(value: string, locale: string): string {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    formatters.set(locale, formatter);
  }
  return formatter.format(new Date(value));
}

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatusViewModel, string> = {
  draft: 'Nháp',
  queued: 'Đang chờ gửi',
  sent: 'Đã gửi',
  replied: 'User đã trả lời',
  in_conversation: 'Đang trao đổi',
  declined: 'User từ chối',
  opted_out: 'User đã opt-out',
  completed: 'Đã hoàn tất',
  expired: 'Hết hạn',
  failed: 'Gửi thất bại',
};

/**
 * `sent` is only ever written after the provider accepted the email, so the
 * label can be trusted. `queued` must stay visibly distinct: the invitation
 * exists in the outbox but no email has left the system yet.
 */
export function formatFeedbackStatus(status: FeedbackStatusViewModel): string {
  return FEEDBACK_STATUS_LABELS[status] ?? status;
}

/** Outreach actions are only meaningful once the invitation has really left. */
export function isFeedbackConversationClosed(status: FeedbackStatusViewModel): boolean {
  return ['declined', 'opted_out', 'completed', 'expired', 'failed'].includes(status);
}
