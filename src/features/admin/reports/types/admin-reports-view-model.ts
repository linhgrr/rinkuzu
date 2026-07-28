import type { ReportStatus } from '@/shared/constants/report-status';
import type { ReportQuestionSnapshot } from '@/shared/types/report';

export type AdminReportStatusViewModel = ReportStatus;
export type AdminReportFilterViewModel = 'all' | AdminReportStatusViewModel;
export type AdminReportedQuestionViewModel = ReportQuestionSnapshot;

export interface AdminReportViewModel {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId?: string;
  questionSnapshot?: AdminReportedQuestionViewModel;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: AdminReportStatusViewModel;
  createdAt: string;
  createdAtLabel: string;
  updatedAt: string;
  updatedAtLabel: string;
  resolvedAt?: string;
  resolvedAtLabel?: string;
  resolvedBy?: string;
  adminNotes?: string;
  adminNotesInput: string;
}

export interface AdminReportStatusUpdateInput {
  reportId: string;
  status: AdminReportStatusViewModel;
  adminNotes: string;
}

export interface AdminReportedQuestionUpdateInput {
  reportId: string;
  question: Omit<AdminReportedQuestionViewModel, 'id' | 'index'>;
}
