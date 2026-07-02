import type { LibraryListDto } from '@/dtos/review';
import { fetchApiData } from '@/lib/api/client';
import { toProfileQuizLibraryViewModel } from '@/features/profile/mappers/profile-quiz.mapper';
import type { ProfileQuizLibraryViewModel } from '@/features/profile/types/profile-quiz-view-model';

export async function fetchProfileQuizLibraryViewModel(): Promise<ProfileQuizLibraryViewModel> {
  const data = await fetchApiData<LibraryListDto>('/api/library?limit=100');
  return toProfileQuizLibraryViewModel(data);
}
