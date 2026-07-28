import type { Report } from '@/entities/Report';
import type { ReportStatus } from '@/shared/constants/report-status';
import type { ReportQuestionSnapshot } from '@/shared/types/report';
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
  questionSnapshot: ReportQuestionSnapshot;
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
