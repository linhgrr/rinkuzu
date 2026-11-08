// A fixed locale keeps server and client output identical; a bare
// toLocaleString() follows the runtime's locale and can break hydration.
const countFormat = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Pinned locale and time zone for the same hydration reason; admins read UTC.
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export function formatDateTimeUtc(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : `${dateTimeFormat.format(date)} UTC`;
}
