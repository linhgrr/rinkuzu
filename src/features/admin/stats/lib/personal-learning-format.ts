import type { PersonalLearningSubjectViewModel } from '@/features/admin/stats/types/personal-learning-view-model';

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

/** A deleted or unreadable account degrades to a shortened id, never a blank row. */
export function learnerLabel(subject: PersonalLearningSubjectViewModel): string {
  if (subject.displayName) return subject.displayName;
  if (subject.email) return subject.email;
  if (!subject.userId) return '—';
  return `#${subject.userId.slice(-8)}`;
}
