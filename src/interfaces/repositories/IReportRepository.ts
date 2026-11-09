import type { Report } from '@/entities/Report';
import type { ReportStatus } from '@/shared/constants/report-status';
import type { ReportReason } from '@/shared/constants/report-reason';
import type { ReportQuestionSnapshotPersistence } from '@/repositories/types/ReportPersistence';
import type {
  PaginatedRepositoryResult,
  RepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface ReportFindOptions extends RepositoryPaginationOptions {
  status?: ReportStatus;
}

export interface CreateReportData {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  questionId: string;
  questionSnapshot: ReportQuestionSnapshotPersistence;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
}

interface ReportResolution {
  resolvedAt: Date;
  resolvedBy: string;
}

export interface UpdateReportData {
  status: ReportStatus;
  resolution: ReportResolution | null;
  adminNotes?: string;
}

export interface IReportRepository {
  findById(id: string): Promise<Report | null>;

  findAll(options: ReportFindOptions): Promise<PaginatedRepositoryResult<Report>>;

  create(reportData: CreateReportData): Promise<Report>;

  update(id: string, reportData: UpdateReportData): Promise<Report | null>;

  delete(id: string): Promise<boolean>;
}

/** A report filed from the quiz page, signed in or not (RIN-1343). */
export interface CreateQuizPageReportData {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reason: ReportReason;
  content?: string;
  reporterEmail?: string;
  reporterName?: string;
  ipHash: string;
}

export interface IQuizPageReportRepository {
  createQuizPageReport(reportData: CreateQuizPageReportData): Promise<Report>;
}
