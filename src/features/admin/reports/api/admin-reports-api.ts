import type { AdminReportListDto, AdminReportStatusDto } from '@/dtos/admin-report';
import { fetchApiData } from '@/lib/api/client';
import { toAdminReportViewModels } from '@/features/admin/reports/mappers/admin-reports.mapper';
import type {
  AdminReportFilterViewModel,
  AdminReportStatusViewModel,
  AdminReportViewModel,
} from '@/features/admin/reports/types/admin-reports-view-model';

export async function fetchAdminReportViewModels(
  statusFilter: AdminReportFilterViewModel,
  signal?: AbortSignal,
): Promise<AdminReportViewModel[]> {
  const params = new URLSearchParams();
  if (statusFilter !== 'all') {
    params.append('status', statusFilter);
  }

  const data = await fetchApiData<AdminReportListDto>(`/api/admin/reports?${params}`, { signal });
  return toAdminReportViewModels(data.reports);
}

export async function updateAdminReportStatus({
  reportId,
  status,
  adminNotes,
}: {
  reportId: string;
  status: AdminReportStatusViewModel;
  adminNotes: string;
}): Promise<void> {
  await fetchApiData<null>(`/api/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: status satisfies AdminReportStatusDto,
      adminNotes,
    }),
  });
}

export async function deleteAdminReport(reportId: string): Promise<void> {
  await fetchApiData<null>(`/api/admin/reports/${reportId}`, {
    method: 'DELETE',
  });
}
