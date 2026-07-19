import type { ReportStatus } from '@/shared/constants/report-status';
import type { MongoIdLike } from '@/types/mongo';

export interface ReportPersistenceRecord {
  _id: MongoIdLike;
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
