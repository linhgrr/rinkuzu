import type { LibraryListDto } from '@/dtos/review';
import { fetchApiData } from '@/lib/api/client';
import { toProfileQuizLibraryViewModel } from '@/features/profile/mappers/profile-quiz.mapper';
import type {
  ProfileQuizLibraryPageQuery,
  ProfileQuizLibraryViewModel,
} from '@/features/profile/types/profile-quiz-view-model';

/** Quizzes per /my-quizzes page; Load more fetches the next one (RIN-1206). */
const PROFILE_QUIZ_PAGE_SIZE = 24;

/** One server-filtered page of the caller's library; `q` is sent only when it is not blank. */
export async function fetchProfileQuizLibraryPage({
  page,
  status,
  q,
}: ProfileQuizLibraryPageQuery): Promise<ProfileQuizLibraryViewModel> {
  const params = new URLSearchParams({ limit: String(PROFILE_QUIZ_PAGE_SIZE), page: String(page) });
  if (status !== 'all') params.set('status', status);
  const search = q.trim();
  if (search) params.set('q', search);
  const data = await fetchApiData<LibraryListDto>(`/api/library?${params}`);
  return toProfileQuizLibraryViewModel(data);
}
