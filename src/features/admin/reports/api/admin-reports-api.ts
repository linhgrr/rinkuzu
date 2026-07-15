import type { AdminReportListDto, AdminReportStatusDto } from '@/dtos/admin-report';
import type { AdminMessageDto } from '@/dtos/admin-user';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import { toAdminReportViewModels } from '@/features/admin/reports/mappers/admin-reports.mapper';
import type {
  AdminReportFilterViewModel,
  AdminReportStatusUpdateInput,
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

  const data = await fetchApiData<AdminReportListDto>(`/api/admin/reports?${params}`, {
    ...(signal !== undefined ? { signal } : {}),
  });
  return toAdminReportViewModels(data.reports);
}

export async function updateAdminReportStatus({
  reportId,
  status,
  adminNotes,
}: AdminReportStatusUpdateInput): Promise<AdminMessageDto> {
  return fetchApiData<AdminMessageDto>(`/api/admin/reports/${reportId}`, {
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

export async function deleteAdminReport(reportId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/admin/reports/${reportId}`, {
    method: 'DELETE',
  });
}
