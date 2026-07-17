import type { AdminReportDto } from '@/dtos/admin-report';
import { formatDateTime } from '@/lib/formatters';
import type { AdminReportViewModel } from '@/features/admin/reports/types/admin-reports-view-model';

const EMPTY_DATE_LABEL = '—';

function formatReportDateLabel(value: string | undefined): string {
  return value ? formatDateTime(value, { emptyLabel: EMPTY_DATE_LABEL }) : EMPTY_DATE_LABEL;
}

function toAdminReportViewModel(report: AdminReportDto): AdminReportViewModel {
  return {
    id: report.id,
    quizId: report.quizId,
    quizTitle: report.quizTitle,
    quizSlug: report.quizSlug,
    reporterEmail: report.reporterEmail,
    reporterName: report.reporterName,
    content: report.content,
    status: report.status,
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
