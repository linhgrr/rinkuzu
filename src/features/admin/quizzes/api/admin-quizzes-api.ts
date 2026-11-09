import type {
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizPersonalDataFlagClearDto,
  AdminQuizVisibilityChangeDto,
} from '@/dtos/admin-quiz';
import type { AdminStarterQuizListDto } from '@/dtos/admin-starter-quiz';
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
import { toAdminStarterQuizViewModels } from '@/features/admin/quizzes/mappers/admin-starter-quizzes.mapper';
import type {
  AdminStarterQuizMarkInput,
  AdminStarterQuizUpdateInput,
  AdminStarterQuizViewModel,
} from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';

export async function fetchAdminQuizListViewModel({
  page,
  limit,
  search,
  visibility,
  flag,
  signal,
}: AdminQuizListQueryInput): Promise<AdminQuizListViewModel> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search) params.set('search', search);
  if (visibility !== 'all') params.set('visibility', visibility);
  if (flag !== 'all') params.set('flag', flag);

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

/** Admin Clear flag for the personal-data check; audited server-side (RIN-1342). */
export async function clearAdminQuizPersonalDataFlag(
  quizId: string,
): Promise<AdminQuizPersonalDataFlagClearDto> {
  return fetchApiData<AdminQuizPersonalDataFlagClearDto>(
    `/api/admin/quizzes/${quizId}/clear-personal-data-flag`,
    { method: 'POST' },
  );
}

const STARTER_QUIZZES_PATH = '/api/admin/starter-quizzes';
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

async function requestStarterQuizzes(
  path: string,
  init: RequestInit,
): Promise<AdminStarterQuizViewModel[]> {
  const data = await fetchApiData<AdminStarterQuizListDto>(path, init);
  return toAdminStarterQuizViewModels(data);
}

/** The starters in order (RIN-1177). */
export async function fetchAdminStarterQuizzes(
  signal?: AbortSignal,
): Promise<AdminStarterQuizViewModel[]> {
  return requestStarterQuizzes(STARTER_QUIZZES_PATH, signal ? { signal } : {});
}

/** Mark a quiz as a starter; resolves to the new list. */
export async function markStarterQuiz(
  input: AdminStarterQuizMarkInput,
): Promise<AdminStarterQuizViewModel[]> {
  return requestStarterQuizzes(STARTER_QUIZZES_PATH, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

/** Change locale or move to a 1-based position; resolves to the new list. */
export async function updateStarterQuiz(
  starterId: string,
  input: AdminStarterQuizUpdateInput,
): Promise<AdminStarterQuizViewModel[]> {
  return requestStarterQuizzes(`${STARTER_QUIZZES_PATH}/${starterId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

/** Unmark a starter; resolves to the new list. */
export async function unmarkStarterQuiz(starterId: string): Promise<AdminStarterQuizViewModel[]> {
  return requestStarterQuizzes(`${STARTER_QUIZZES_PATH}/${starterId}`, { method: 'DELETE' });
}
