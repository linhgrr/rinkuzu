import type { ReportStatus } from '@/shared/constants/report-status';

export interface ReportCoreFields {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
}

export interface ReportFields extends ReportCoreFields {
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}
