import type { Report, ReportStatus } from '@/entities/Report';
import type {
  PaginatedRepositoryResult,
  RequiredRepositoryPaginationOptions,
} from '@/interfaces/repositories/types';

export interface ReportFindOptions extends RequiredRepositoryPaginationOptions {
  status?: ReportStatus;
}

export interface CreateReportData {
  quizId: string;
  quizTitle: string;
  quizSlug: string;
  reporterEmail: string;
  reporterName: string;
  content: string;
  status: ReportStatus;
}

export interface UpdateReportData {
  status: ReportStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
  adminNotes?: string;
}

export interface IReportRepository {
  findById(id: string): Promise<Report | null>;

  findAll(options: ReportFindOptions): Promise<PaginatedRepositoryResult<Report>>;

  create(reportData: CreateReportData): Promise<Report>;

  update(id: string, reportData: UpdateReportData): Promise<Report | null>;

  delete(id: string): Promise<boolean>;
}
