export type AdminReportStatusViewModel = 'pending' | 'resolved' | 'dismissed';
export type AdminReportFilterViewModel = 'all' | AdminReportStatusViewModel;

export interface AdminReportViewModel {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
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
