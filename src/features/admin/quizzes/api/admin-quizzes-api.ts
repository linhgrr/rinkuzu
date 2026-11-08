import type {
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizVisibilityChangeDto,
} from '@/dtos/admin-quiz';
import type {
  AdminStarterQuizCreateBodyDto,
  AdminStarterQuizListDto,
  AdminStarterQuizUpdateBodyDto,
} from '@/dtos/admin-starter-quiz';
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

export async function setAdminQuizVisibility(
  quizId: string,
  visibility: 'public' | 'personal',
): Promise<AdminQuizVisibilityChangeDto> {
  return fetchApiData<AdminQuizVisibilityChangeDto>(`/api/admin/quizzes/${quizId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibility }),
  });
}

const STARTER_QUIZZES_PATH = '/api/admin/starter-quizzes';
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** @public Used by the admin starter list (RIN-1177 part 3). */
export async function fetchAdminStarterQuizzes(
  signal?: AbortSignal,
): Promise<AdminStarterQuizListDto> {
  return fetchApiData<AdminStarterQuizListDto>(STARTER_QUIZZES_PATH, signal ? { signal } : {});
}

/** @public Mark a quiz as a starter; resolves to the new list. */
export async function markStarterQuiz(
  body: AdminStarterQuizCreateBodyDto,
): Promise<AdminStarterQuizListDto> {
  return fetchApiData<AdminStarterQuizListDto>(STARTER_QUIZZES_PATH, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** @public Change locale or move to a 1-based position; resolves to the new list. */
export async function updateStarterQuiz(
  starterId: string,
  body: AdminStarterQuizUpdateBodyDto,
): Promise<AdminStarterQuizListDto> {
  return fetchApiData<AdminStarterQuizListDto>(`${STARTER_QUIZZES_PATH}/${starterId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** @public Unmark a starter; resolves to the new list. */
export async function unmarkStarterQuiz(starterId: string): Promise<AdminStarterQuizListDto> {
  return fetchApiData<AdminStarterQuizListDto>(`${STARTER_QUIZZES_PATH}/${starterId}`, {
    method: 'DELETE',
  });
}
