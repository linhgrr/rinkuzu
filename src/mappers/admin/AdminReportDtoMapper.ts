import type {
  AdminReportDto,
  AdminReportListDto,
  AdminReportedQuestionDto,
} from '@/dtos/admin-report';
import type { PaginationMeta } from '@/dtos/common';
import type { Report } from '@/entities/Report';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';
import { copyReportCoreFields, toReportQuestionSnapshot } from '@/lib/report-fields';
import type { QuizQuestion } from '@/entities/Quiz';

export class AdminReportDtoMapper {
  static toQuestionDto(question: QuizQuestion, index: number): AdminReportedQuestionDto {
    return toReportQuestionSnapshot(question, index);
  }

  static toListDto(reports: Report[], pagination: PaginationMeta): AdminReportListDto {
    return {
      reports: reports.map(AdminReportDtoMapper.toDto),
      pagination,
    };
  }

  static toDto(report: Report): AdminReportDto {
    const resolvedAt = serializeOptionalDate(report.resolvedAt, 'report.resolvedAt');

    return {
      ...copyReportCoreFields(report),
      createdAt: serializeDate(report.createdAt, 'report.createdAt'),
      updatedAt: serializeDate(report.updatedAt, 'report.updatedAt'),
      ...(resolvedAt !== undefined && { resolvedAt }),
      ...(report.resolvedBy !== undefined && { resolvedBy: report.resolvedBy }),
      ...(report.adminNotes !== undefined && { adminNotes: report.adminNotes }),
    };
  }
}
