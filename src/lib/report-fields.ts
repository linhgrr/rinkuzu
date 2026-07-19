import type { ReportCoreFields } from '@/shared/types/report';

export interface IdentifiedReportCoreFields extends ReportCoreFields {
  id: string;
}

export function copyReportCoreFields(
  report: IdentifiedReportCoreFields,
): IdentifiedReportCoreFields {
  return {
    id: report.id,
    quizId: report.quizId,
    quizTitle: report.quizTitle,
    quizSlug: report.quizSlug,
    reporterEmail: report.reporterEmail,
    reporterName: report.reporterName,
    content: report.content,
    status: report.status,
  };
}
