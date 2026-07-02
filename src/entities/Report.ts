export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}
