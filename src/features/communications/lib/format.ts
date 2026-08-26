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
