import type { ReportStatus } from '@/shared/constants/report-status';
import type { QuestionType } from '@/shared/constants/question-type';
import type { ReportReason, ReportSource } from '@/shared/constants/report-reason';

export type AdminReportStatusViewModel = ReportStatus;
export type AdminReportFilterViewModel = 'all' | AdminReportStatusViewModel;
export type AdminReportReasonFilterViewModel = 'all' | ReportReason;

export interface AdminReportListFilters {
  status: AdminReportFilterViewModel;
  reason: AdminReportReasonFilterViewModel;
}

/**
 * The reported question as the admin screen renders it.
 *
 * Declared here rather than aliased from AdminReportedQuestionDto: a view model
 * that *is* the DTO moves whenever the wire shape does, and the checker's
 * feature-non-boundary rule exists to stop exactly that.
 */
export interface AdminReportedQuestionViewModel {
  id: string;
  index: number;
  question: string;
  options: string[];
  type: QuestionType;
  correctIndex?: number;
  correctIndexes?: number[];
  questionImage?: string;
  optionImages?: (string | undefined)[];
}

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
  /** Quiz-page reports only (RIN-1343); per-question reports have none. */
  reason?: ReportReason;
  source?: ReportSource;
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

export interface AdminReportListViewModel {
  reports: AdminReportViewModel[];
  /** Pending copyright/personal-data reports across all quizzes. */
  pendingIndexHoldCount: number;
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
