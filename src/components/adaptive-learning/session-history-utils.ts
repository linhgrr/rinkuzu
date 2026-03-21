export function formatSessionHistoryDate(ts: number, locale = 'vi-VN') {
  if (!ts)
    return '—'

  return new Date(ts * 1000).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}
