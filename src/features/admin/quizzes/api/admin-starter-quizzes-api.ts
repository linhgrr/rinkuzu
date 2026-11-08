import type {
  AdminStarterQuizCreateBodyDto,
  AdminStarterQuizListDto,
  AdminStarterQuizUpdateBodyDto,
} from '@/dtos/admin-starter-quiz';
import { fetchApiData } from '@/lib/api/client';

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
