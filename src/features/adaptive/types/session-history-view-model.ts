import type { PipelineStatus } from '@/features/adaptive/types/pipeline';

export interface SessionHistoryViewModel {
  jobId: string;
  filename: string;
  subjectId: string;
  displayTitle: string;
  status: PipelineStatus;
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
