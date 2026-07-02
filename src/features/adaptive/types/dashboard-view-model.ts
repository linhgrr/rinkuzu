import type { PipelineJobListItem, PipelineStatus } from '@/features/adaptive/types/pipeline';

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
  relationsVerified: number;
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
};

export type DashboardPipelineJobListItem = PipelineJobListItem;
