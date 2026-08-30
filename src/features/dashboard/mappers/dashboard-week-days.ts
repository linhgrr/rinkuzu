import type { DashboardStatsDto } from '@/dtos/dashboard';
import type { DashboardViewModel } from '@/features/dashboard/types/dashboard-view-model';
import { toUtcDateKey } from '@/lib/date-serialization';

/**
 * The seven day slots of the current week, lit where the user was active.
 *
 * weeklyActivity is keyed by UTC date: QuizAttemptProgressRepository writes it
 * with setUTCDate + toUtcDateKey. Reading it back through local getters -- as
 * this did until 2026-08-30 -- puts the week window and the keys on two
 * different calendars. In UTC+7 that misfiled every attempt made between 00:00
 * and 07:00 local, and near a week boundary dropped it from the chart
 * altogether, because the local week could ask for a key the UTC week never
 * wrote. Both ends run on UTC here so the two agree.
 *
 * That leaves a day boundary at UTC midnight rather than at Vietnamese
 * midnight, which is the write side's choice; moving it would re-key stored
 * documents, so it is a migration rather than a mapper change.
 */
export function buildWeekDays(
  weeklyActivity: DashboardStatsDto['weeklyActivity'],
  labels: string[],
): DashboardViewModel['progress']['weekDays'] {
  const today = new Date();
  const sunday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay()),
  );

  return labels.map((label, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + index);
    const key = toUtcDateKey(date, 'weeklyActivity.date');

    return {
      label,
      active: (weeklyActivity[key]?.questionsReviewed ?? 0) > 0,
    };
  });
}
