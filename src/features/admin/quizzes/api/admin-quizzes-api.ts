import type { AdminQuizDetailDto, AdminQuizListDto } from '@/dtos/admin-quiz';
import type { DeleteResultDto } from '@/dtos/common';
import { fetchApiData } from '@/lib/api/client';
import {
  toAdminQuizDetailViewModel,
  toAdminQuizListViewModel,
} from '@/features/admin/quizzes/mappers/admin-quizzes.mapper';
import type {
  AdminQuizDetailViewModel,
  AdminQuizListQueryInput,
  AdminQuizListViewModel,
} from '@/features/admin/quizzes/types/admin-quizzes-view-model';

export async function fetchAdminQuizListViewModel({
  page,
  limit,
  search,
  visibility,
  signal,
}: AdminQuizListQueryInput): Promise<AdminQuizListViewModel> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) params.set('search', search);
  if (visibility !== 'all') params.set('visibility', visibility);

  const data = await fetchApiData<AdminQuizListDto>(`/api/admin/quizzes?${params}`, { signal });
  return toAdminQuizListViewModel(data);
}

export async function fetchAdminQuizDetailViewModel(
  quizId: string,
): Promise<AdminQuizDetailViewModel> {
  const data = await fetchApiData<AdminQuizDetailDto>(`/api/admin/quizzes/${quizId}`);
  return toAdminQuizDetailViewModel(data);
}

export async function deleteAdminQuiz(quizId: string): Promise<DeleteResultDto> {
  return fetchApiData<DeleteResultDto>(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' });
}
