import type { AdminReportDto, AdminReportListDto } from '@/dtos/admin-report';
import type { PaginationMeta } from '@/dtos/common';
import type { Report } from '@/entities/Report';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';
import { copyReportCoreFields } from '@/lib/report-fields';

export class AdminReportDtoMapper {
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
