import type { PipelineJobListItem, PipelineStatus } from '@/features/adaptive/types/pipeline';
import type { SubjectProgressStatus } from '@/features/adaptive/types/history';

// Exercise-history signal joined onto a subject from the progress endpoint.
// Absent when the learner has never practised the subject (= not started).
export type DashboardSubjectExercise = {
  status: SubjectProgressStatus;
  totalAnswered: number;
  progressPercent: number;
};

export type SubjectRuntime =
  | { kind: 'ready' }
  | { kind: 'processing'; progressPercent: number; stageLabel: string; etaSeconds: number | null }
  | { kind: 'retryable'; message: string };

export type DashboardSubjectMetrics = {
  masteredConcepts: number;
  allConcepts: number;
  progressPercent: number;
  remainingConcepts: number;
};

export type DashboardSubject = {
  jobId: string;
  filename: string;
  subjectId: string;
  status: PipelineStatus;
  conceptsExtracted: number;
  conceptsAfterMerge: number;
  relationsAccepted: number;
  completedAt: number | null;
  masteredConcept: number;
  allConcept: number;
  progressPercent: number;
  displayTitle: string;
  lastOpenedLabel: string;
  progressLabel: string;
  ctaLabel: string;
  metrics: DashboardSubjectMetrics;
  runtime: SubjectRuntime;
  exercise: DashboardSubjectExercise | null;
};

export type DashboardPipelineJobListItem = PipelineJobListItem;
