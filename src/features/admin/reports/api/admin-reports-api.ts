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
  AdminReportListFilters,
  AdminReportListViewModel,
  AdminReportedQuestionViewModel,
  AdminReportedQuestionUpdateInput,
  AdminReportStatusUpdateInput,
} from '@/features/admin/reports/types/admin-reports-view-model';

export async function fetchAdminReportViewModels(
  { status, reason }: AdminReportListFilters,
  signal?: AbortSignal,
): Promise<AdminReportListViewModel> {
  const params = new URLSearchParams();
  if (status !== 'all') {
    params.append('status', status);
  }
  if (reason !== 'all') {
    params.append('reason', reason);
  }

  const data = await fetchApiData<AdminReportListDto>(`/api/admin/reports?${params}`, {
    ...(signal !== undefined ? { signal } : {}),
  });
  return {
    reports: toAdminReportViewModels(data.reports),
    pendingIndexHoldCount: data.pendingIndexHoldCount,
  };
}

/** Hides the reported quiz (audited) and resolves the report (RIN-1343 C1). */
export async function hideAdminReportedQuiz(reportId: string, adminNotes: string): Promise<void> {
  await fetchApiData<unknown>(`/api/admin/reports/${reportId}/hide-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(adminNotes ? { adminNotes } : {}),
  });
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
