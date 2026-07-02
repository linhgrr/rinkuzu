import type { SessionHistoryItem } from '@/features/adaptive/types/history';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';

function filenameStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function toPercent(value: number): number {
  return clampPercent(value * 100);
}

export function toSessionHistoryViewModel(item: SessionHistoryItem): SessionHistoryViewModel {
  const displayTitle =
    item.subject_id || filenameStem(item.filename) || item.job_id.substring(0, 8);
  const lastActivityAt = item.updated_at || item.created_at;

  return {
    jobId: item.job_id,
    filename: item.filename,
    subjectId: item.subject_id,
    displayTitle,
    status: item.status,
    step: item.step,
    maxSteps: item.max_steps,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    lastActivityAt,
    totalCorrect: item.total_correct,
    totalAnswered: item.total_answered,
    accuracyPercent: toPercent(item.accuracy),
    averageMasteryPercent: toPercent(item.avg_mastery),
  };
}

export function toSessionHistoryViewModels(items: SessionHistoryItem[]): SessionHistoryViewModel[] {
  return items.map(toSessionHistoryViewModel);
}
