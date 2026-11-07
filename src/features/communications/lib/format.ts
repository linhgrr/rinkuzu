import type { FeedbackStatusViewModel } from '../types/communication-view-model';
import { DEFAULT_DATE_TIME_ZONE } from '@/lib/formatters';

const formatters = new Map<string, Intl.DateTimeFormat>();

export function formatCommunicationTimestamp(value: string, locale: string): string {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: DEFAULT_DATE_TIME_ZONE,
    });
    formatters.set(locale, formatter);
  }
  return formatter.format(new Date(value));
}

/** Outreach actions are only meaningful once the invitation has really left. */
export function isFeedbackConversationClosed(status: FeedbackStatusViewModel): boolean {
  return ['declined', 'opted_out', 'completed', 'expired', 'failed'].includes(status);
}
