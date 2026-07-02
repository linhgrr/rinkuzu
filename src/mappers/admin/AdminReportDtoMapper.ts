import type { AdminReportDto, AdminReportListDto } from '@/dtos/admin-report';
import type { PaginationMeta } from '@/dtos/common';
import type { Report } from '@/entities/Report';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class AdminReportDtoMapper {
  static toListDto(reports: Report[], pagination: PaginationMeta): AdminReportListDto {
    return {
      reports: reports.map(AdminReportDtoMapper.toDto),
      pagination,
    };
  }

  static toDto(report: Report): AdminReportDto {
    return {
      id: report.id,
      quizId: report.quizId,
      quizTitle: report.quizTitle,
      quizSlug: report.quizSlug,
      reporterEmail: report.reporterEmail,
      reporterName: report.reporterName,
      content: report.content,
      status: report.status,
      createdAt: serializeDate(report.createdAt, 'report.createdAt'),
      updatedAt: serializeDate(report.updatedAt, 'report.updatedAt'),
      resolvedAt: serializeOptionalDate(report.resolvedAt, 'report.resolvedAt'),
      resolvedBy: report.resolvedBy,
      adminNotes: report.adminNotes,
    };
  }
}
