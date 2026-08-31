import type { TranslateFn } from '@/features/adaptive/types/learning';
import { toTimestampMs } from '@/lib/epoch';

/**
 * How long ago a session was last touched, in the sidebar's short vocabulary.
 *
 * This lived inside OverviewSidebar.tsx, where it was pure logic in a file with
 * no tests, and normalised its own epoch value with a fourth copy of the
 * seconds-or-milliseconds rule. The buckets and translation keys are the
 * sidebar's own -- the adaptive and dashboard mappers phrase the same idea
 * differently, with different boundaries -- so this is extracted, not merged.
 */
export function formatSessionRelativeTime(
  timestamp: number | null | undefined,
  t: TranslateFn,
): string {
  const normalized = toTimestampMs(timestamp);
  // An unusable timestamp reads as "just now" rather than as NaN: the sidebar
  // shows it inline in a sentence, where a blank or a number would be worse.
  if (normalized === null) return t('minutesAgo', { count: 1 });

  const minutes = Math.max(0, Math.floor((Date.now() - normalized) / 60_000));
  if (minutes < 60) return t('minutesAgo', { count: Math.max(1, minutes) });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgoShort', { count: hours });

  return t('daysAgoShort', { count: Math.floor(hours / 24) });
}
