import type { AdminReportDto } from '@/dtos/admin-report';
import { formatDateTime } from '@/lib/formatters';
import { copyReportCoreFields } from '@/lib/report-fields';
import type { AdminReportViewModel } from '@/features/admin/reports/types/admin-reports-view-model';

const EMPTY_DATE_LABEL = '—';

function formatReportDateLabel(value: string | undefined): string {
  return value ? formatDateTime(value, { emptyLabel: EMPTY_DATE_LABEL }) : EMPTY_DATE_LABEL;
}

function toAdminReportViewModel(report: AdminReportDto): AdminReportViewModel {
  return {
    ...copyReportCoreFields(report),
    createdAt: report.createdAt,
    createdAtLabel: formatReportDateLabel(report.createdAt),
    updatedAt: report.updatedAt,
    updatedAtLabel: formatReportDateLabel(report.updatedAt),
    ...(report.resolvedAt !== undefined && {
      resolvedAt: report.resolvedAt,
      resolvedAtLabel: formatReportDateLabel(report.resolvedAt),
    }),
    ...(report.resolvedBy !== undefined && { resolvedBy: report.resolvedBy }),
    ...(report.adminNotes !== undefined && { adminNotes: report.adminNotes }),
    adminNotesInput: report.adminNotes ?? '',
  };
}

export function toAdminReportViewModels(reports: AdminReportDto[]): AdminReportViewModel[] {
  return reports.map(toAdminReportViewModel);
}
