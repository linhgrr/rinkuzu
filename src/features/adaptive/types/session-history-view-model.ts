import type { SubjectProgressStatus } from '@/features/adaptive/types/history';

export interface SessionHistoryViewModel {
  jobId: string;
  filename: string;
  subjectId: string;
  displayTitle: string;
  status: SubjectProgressStatus;
  step: number;
  maxSteps: number;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  totalCorrect: number;
  totalAnswered: number;
  accuracyPercent: number;
  averageMasteryPercent: number;
}
