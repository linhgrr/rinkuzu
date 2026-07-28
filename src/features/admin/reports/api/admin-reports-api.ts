import type {
  AdminReportListDto,
  AdminReportStatusDto,
  AdminReportedQuestionDto,
} from '@/dtos/admin-report';
import type { AdminMessageDto } from '@/dtos/admin-user';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminReportViewModels,
  toAdminReportedQuestionViewModel,
} from '@/features/admin/reports/mappers/admin-reports.mapper';
import type {
  AdminReportFilterViewModel,
  AdminReportedQuestionViewModel,
  AdminReportedQuestionUpdateInput,
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

export async function fetchAdminReportedQuestion(
  reportId: string,
  signal?: AbortSignal,
): Promise<AdminReportedQuestionViewModel> {
  const dto = await fetchApiData<AdminReportedQuestionDto>(
    `/api/admin/reports/${reportId}/question`,
    {
      ...(signal !== undefined ? { signal } : {}),
    },
  );
  return toAdminReportedQuestionViewModel(dto);
}

export async function updateAdminReportedQuestion({
  reportId,
  question,
}: AdminReportedQuestionUpdateInput): Promise<AdminReportedQuestionViewModel> {
  const dto = await fetchApiData<AdminReportedQuestionDto>(
    `/api/admin/reports/${reportId}/question`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(question),
    },
  );
  return toAdminReportedQuestionViewModel(dto);
}
