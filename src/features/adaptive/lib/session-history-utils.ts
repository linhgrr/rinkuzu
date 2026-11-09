import { formatDateTime } from '@/lib/formatters';

/** `locale` is the active app locale; there is no Vietnamese default (RIN-1265). */
export function formatSessionHistoryDate(ts: number, locale: string) {
  if (!ts) return '—';

  return formatDateTime(ts * 1000, { locale, emptyLabel: '—' });
}
