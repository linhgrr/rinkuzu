import { formatDateTime } from '@/lib/formatters';

export function formatSessionHistoryDate(ts: number, locale = 'vi-VN') {
  if (!ts) return '—';

  return formatDateTime(ts * 1000, { locale, emptyLabel: '—' });
}
